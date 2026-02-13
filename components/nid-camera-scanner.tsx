"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { createWorker, Worker as TesseractWorker } from "tesseract.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";

interface NIDCameraScannerProps {
  onNIDDetected: (nidNumber: string) => void;
  onCancel: () => void;
}

// ── Regex patterns defined OUTSIDE the component (created once, no GC churn) ──
// NID formats:
// 1. XXX-XXX-XXXX-XXXX (e.g., RAM-KTM-1990-4521)
// 2. XXX-XXX-XXX (e.g., 123-456-789)
const NID_PATTERN_LONG = /\b([A-Z]{3,4})-([A-Z]{3,4})-(\d{4})-(\d{4})\b/i;
const NID_PATTERN_SHORT = /\b(\d{3})-(\d{3})-(\d{3})\b/;
const ALT_PATTERN_LONG = /\b([A-Z]{3,4})[\s\-\.]+([A-Z]{3,4})[\s\-\.]+(\d{4})[\s\-\.]+(\d{4})\b/i;
const ALT_PATTERN_SHORT = /\b(\d{3})[\s\-\.](\d{3})[\s\-\.](\d{3})\b/;

/**
 * Clean OCR text — only replace ambiguous chars in DIGIT positions,
 * NOT blanket-replacing all 'O' → '0' (which corrupts alpha NID portions).
 */
function cleanOCRText(text: string): string {
  // Normalize pipe → I (common OCR misread)
  let clean = text.replace(/[|]/g, "I");
  // Normalize common OCR substitutions only in purely numeric segments:
  // e.g. "l23-4S6-7B9" → "123-456-789"
  // We do NOT replace O→0 globally — that corrupts "KTM" → "KTM" is fine, but "ROM" → "R0M" is wrong.
  clean = clean.replace(/\b(\d[\dOolISBG\-\.\s]+\d)\b/g, (segment) => {
    return segment
      .replace(/[Oo]/g, "0")
      .replace(/[Il]/g, "1")
      .replace(/[Ss]/g, "5")
      .replace(/[Bb]/g, "8")
      .replace(/[Gg]/g, "9");
  });
  return clean.toUpperCase();
}

/**
 * Extract NID number from OCR text using multiple pattern strategies.
 */
function extractNIDFromText(text: string): string | null {
  const cleanText = cleanOCRText(text);

  // Try exact short numeric pattern first (123-456-789)
  const shortMatch = cleanText.match(NID_PATTERN_SHORT);
  if (shortMatch) return shortMatch[0];

  // Try exact long alphanumeric pattern (RAM-KTM-1990-4521)
  const longMatch = cleanText.match(NID_PATTERN_LONG);
  if (longMatch) return longMatch[0];

  // Try alternative patterns (spaces, dots, etc.) for long format
  const altLongMatch = cleanText.match(ALT_PATTERN_LONG);
  if (altLongMatch) {
    const parts = altLongMatch[0].split(/[\s\-\.]+/);
    if (parts.length === 4) {
      return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
    }
  }

  // Try alternative for short format
  const altShortMatch = cleanText.match(ALT_PATTERN_SHORT);
  if (altShortMatch) {
    const parts = altShortMatch[0].split(/[\s\-\.]+/);
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
  }

  return null;
}

/**
 * Crop the center region of a base64 image to focus OCR on the NID card area.
 * Returns a cropped base64 JPEG string.
 */
function cropToROI(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Crop to the center ~60% width, ~50% height (where the NID card frame is)
      const cropW = Math.round(img.width * 0.7);
      const cropH = Math.round(img.height * 0.55);
      const cropX = Math.round((img.width - cropW) / 2);
      const cropY = Math.round((img.height - cropH) / 2);

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(imageSrc); return; }
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(imageSrc); // Fallback to full image
    img.src = imageSrc;
  });
}

export function NIDCameraScanner({ onNIDDetected, onCancel }: NIDCameraScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Persistent OCR worker (created once, reused across scans) ──
  const workerRef = useRef<TesseractWorker | null>(null);
  const workerReadyRef = useRef(false);
  // Use a ref for detecting to avoid stale closure in setInterval
  const detectingRef = useRef(false);

  // Initialize Tesseract worker once on mount
  useEffect(() => {
    let cancelled = false;

    async function initWorker() {
      try {
        const worker = await createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });
        if (!cancelled) {
          workerRef.current = worker;
          workerReadyRef.current = true;
        } else {
          // Component unmounted before init finished
          await worker.terminate();
        }
      } catch (err) {
        console.error("Failed to initialize OCR worker:", err);
      }
    }

    initWorker();

    return () => {
      cancelled = true;
      // Terminate worker on unmount
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        workerReadyRef.current = false;
      }
      // Clear scan interval
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  const captureAndProcess = useCallback(async () => {
    if (!webcamRef.current || !workerRef.current || !workerReadyRef.current) return;
    // Use ref to prevent concurrent OCR runs (avoids stale closure issue)
    if (detectingRef.current) return;

    detectingRef.current = true;
    setDetecting(true);
    setOcrProgress(0);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        detectingRef.current = false;
        setDetecting(false);
        return;
      }

      // Crop to ROI (center of frame where NID card is) — 3-5x faster than full frame
      const croppedImage = await cropToROI(imageSrc);

      // Reuse persistent worker
      const { data } = await workerRef.current.recognize(croppedImage);

      // Extract NID from recognized text
      const nidNumber = extractNIDFromText(data.text);

      if (nidNumber) {
        setIsScanning(false);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        toast.success(`NID Detected: ${nidNumber}`);
        onNIDDetected(nidNumber);
      }
    } catch (error) {
      console.error("OCR Error:", error);
    } finally {
      detectingRef.current = false;
      setDetecting(false);
    }
  }, [onNIDDetected]);

  const startScanning = () => {
    setIsScanning(true);
    // Scan every 2.5 seconds (gives OCR time to finish without overlap)
    scanIntervalRef.current = setInterval(() => {
      captureAndProcess();
    }, 2500);
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    onCancel();
  };

  const simulateDetection = () => {
    // Simulate successful NID detection for testing
    const demoNID = "123-456-789";
    toast.success(`Demo NID Detected: ${demoNID}`);
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    onNIDDetected(demoNID);
  };

  // Auto-start scanning when worker is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanning && workerReadyRef.current) {
        startScanning();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Scan NID Card</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Position your National ID card in the frame
          </p>
        </div>

        {/* Camera Preview */}
        <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: "environment",
              width: 1280,
              height: 720,
            }}
            className="w-full h-full object-cover"
          />

          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="relative w-11/12 h-2/3 border-2 border-primary rounded-lg">
                {/* Scanning Animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine className="w-full h-8 text-primary animate-pulse" />
                </div>
                
                {/* Corner Markers */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {detecting && ocrProgress > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing... {ocrProgress}%
            </div>
          )}

          {/* Worker loading indicator */}
          {!workerReadyRef.current && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading OCR engine...
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Scanning automatically...
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Hold the card steady within the frame</li>
            <li>Ensure good lighting (avoid shadows)</li>
            <li>Keep the card flat and in focus</li>
            <li><strong>Center the &ldquo;ID No:&rdquo; section</strong> in the frame</li>
            <li>You can hold your phone farther away - the scanner works at a distance</li>
            <li>Scanner recognizes formats like: <code className="bg-blue-100 px-1 rounded">123-456-789</code></li>
          </ul>
          <div className="mt-2 pt-2 border-t border-border/50">
            <p className="text-xs text-blue-600 font-medium">💡 Testing tip:</p>
            <p className="text-xs text-muted-foreground">Click &ldquo;Demo&rdquo; for instant verification, or scan a physical NID card</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isScanning ? (
            <>
              <Button onClick={startScanning} className="flex-1" size="lg">
                <Camera className="w-4 h-4 mr-2" />
                Start Scanning
              </Button>
              <Button onClick={simulateDetection} variant="secondary" size="lg">
                Demo
              </Button>
              <Button onClick={stopScanning} variant="outline" size="lg">
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="flex-1" size="lg">
              <XCircle className="w-4 h-4 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
