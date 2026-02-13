"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { createWorker } from "tesseract.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";

interface NIDCameraScannerProps {
  onNIDDetected: (nidNumber: string) => void;
  onCancel: () => void;
}

export function NIDCameraScanner({ onNIDDetected, onCancel }: NIDCameraScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // NID formats: 
  // 1. XXX-XXX-XXXX-XXXX (e.g., RAM-KTM-1990-4521)
  // 2. XXX-XXX-XXX (e.g., 123-456-789)
  const NID_PATTERN_LONG = /\b([A-Z]{3,4})-([A-Z]{3,4})-(\d{4})-(\d{4})\b/gi;
  const NID_PATTERN_SHORT = /\b(\d{3})-(\d{3})-(\d{3})\b/g;

  const extractNIDFromText = useCallback((text: string): string | null => {
    // Clean up text
    const cleanText = text.replace(/[|]/g, "I").replace(/[O]/g, "0").toUpperCase();
    
    // Try short numeric pattern first (123-456-789)
    const shortMatches = cleanText.match(NID_PATTERN_SHORT);
    if (shortMatches && shortMatches.length > 0) {
      return shortMatches[0];
    }

    // Try long alphanumeric pattern (RAM-KTM-1990-4521)
    const matches = cleanText.match(NID_PATTERN_LONG);
    if (matches && matches.length > 0) {
      return matches[0];
    }

    // Try alternative patterns (spaces, dots, etc.) for long format
    const altPattern = /\b([A-Z]{3,4})[\s\-\.]*([A-Z]{3,4})[\s\-\.]*(\d{4})[\s\-\.]*(\d{4})\b/gi;
    const altMatches = cleanText.match(altPattern);
    if (altMatches && altMatches.length > 0) {
      // Format it properly
      const parts = altMatches[0].split(/[\s\-\.]+/);
      if (parts.length === 4) {
        return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
      }
    }

    // Try alternative for short format
    const altShortPattern = /\b(\d{3})[\s\-\.](\d{3})[\s\-\.](\d{3})\b/g;
    const altShortMatches = cleanText.match(altShortPattern);
    if (altShortMatches && altShortMatches.length > 0) {
      const parts = altShortMatches[0].split(/[\s\-\.]+/);
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
      }
    }

    return null;
  }, []);

  const captureAndProcess = useCallback(async () => {
    if (!webcamRef.current || detecting) return;

    setDetecting(true);
    setOcrProgress(0);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setDetecting(false);
        return;
      }

      // Create OCR worker
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Process image
      const { data } = await worker.recognize(imageSrc);
      await worker.terminate();

      // Extract NID from recognized text
      const nidNumber = extractNIDFromText(data.text);

      if (nidNumber) {
        setIsScanning(false);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        toast.success(`NID Detected: ${nidNumber}`);
        onNIDDetected(nidNumber);
      } else {
        // Continue scanning
        setDetecting(false);
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setDetecting(false);
    }
  }, [detecting, onNIDDetected, extractNIDFromText]);

  const startScanning = () => {
    setIsScanning(true);
    // Scan every 2 seconds
    scanIntervalRef.current = setInterval(() => {
      captureAndProcess();
    }, 2000);
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

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Auto-start scanning when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isScanning) {
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
              width: 1920,
              height: 1080,
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
