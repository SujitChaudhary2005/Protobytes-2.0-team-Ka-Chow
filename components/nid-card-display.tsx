"use client";

import { useState, useEffect } from "react";
import { NIDCard } from "@/types";
import { Shield, Loader2 } from "lucide-react";

interface NIDCardDisplayProps {
  nid: NIDCard;
  loading?: boolean;
}

/**
 * Nagarik-style NID Card Display
 * Renders a realistic National ID card with data overlaid on a styled template.
 * Resembles the Nagarik app's driving license display — data appears fetched from DB.
 */
export function NIDCardDisplay({ nid, loading = false }: NIDCardDisplayProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showData, setShowData] = useState(false);

  // Animate data appearing after "fetch"
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowData(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowData(false);
    }
  }, [loading]);

  // Extract initials for photo fallback
  const initials = nid.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Generate MRZ-like line for bottom of card
  const mrzLine1 = `ID<NPL<${nid.nidNumber.replace(/-/g, "")}<<<<<<<<<<<<<<<`;
  const mrzLine2 = `${nid.dateOfBirth.replace(/-/g, "")}<${nid.fullName.replace(/ /g, "<").toUpperCase()}<<<<<<<<`;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card Container - realistic ID card aspect ratio */}
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-lg border border-gray-200"
        style={{ aspectRatio: "85.6 / 54", background: "linear-gradient(135deg, #1a237e 0%, #283593 30%, #1565c0 60%, #1976d2 100%)" }}
      >
        {/* Background Pattern - subtle security pattern */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`,
        }} />

        {/* Top Header Bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {/* Nepal Emblem placeholder */}
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">🇳🇵</span>
            </div>
            <div>
              <p className="text-[8px] text-white/80 leading-tight">नेपाल सरकार</p>
              <p className="text-[7px] text-white/60 leading-tight">GOVERNMENT OF NEPAL</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-white tracking-wider">NATIONAL ID</p>
            <p className="text-[7px] text-white/70">राष्ट्रिय परिचयपत्र</p>
          </div>
        </div>

        {/* Thin gold divider */}
        <div className="relative z-10 mx-3 h-[1px] bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />

        {/* Main Card Body */}
        <div className="relative z-10 flex gap-3 px-4 pt-2 pb-1">
          {/* Photo Area (left) */}
          <div className="flex-shrink-0">
            <div className="relative w-[72px] h-[88px] rounded-md overflow-hidden border-2 border-white/30 bg-white/10">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
                </div>
              ) : nid.photoUrl && (nid.photoUrl.startsWith("http") || nid.photoUrl.startsWith("/")) ? (
                <>
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  )}
                  <img
                    src={nid.photoUrl}
                    alt={nid.fullName}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{initials}</span>
                </div>
              )}
              {/* Small "PHOTO" label */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-center">
                <span className="text-[5px] text-white/80 uppercase tracking-widest">Photo</span>
              </div>
            </div>
          </div>

          {/* Data Fields (right) */}
          <div className="flex-1 min-w-0 space-y-[6px] pt-1">
            {/* ID Number */}
            <div>
              <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">ID No. / परिचयपत्र नं.</p>
              {loading || !showData ? (
                <div className="h-3.5 w-28 bg-white/15 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-[11px] font-mono font-bold text-yellow-300 tracking-wider leading-tight">{nid.nidNumber}</p>
              )}
            </div>

            {/* Full Name */}
            <div>
              <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">Name / नाम</p>
              {loading || !showData ? (
                <div className="h-3.5 w-32 bg-white/15 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-[11px] font-semibold text-white leading-tight truncate">{nid.fullName}</p>
              )}
            </div>

            {/* DOB + District row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">DOB / जन्म मिति</p>
                {loading || !showData ? (
                  <div className="h-3 w-16 bg-white/15 rounded animate-pulse mt-0.5" />
                ) : (
                  <p className="text-[10px] text-white/90 leading-tight">{nid.dateOfBirth}</p>
                )}
              </div>
              <div className="flex-1">
                <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">District / जिल्ला</p>
                {loading || !showData ? (
                  <div className="h-3 w-16 bg-white/15 rounded animate-pulse mt-0.5" />
                ) : (
                  <p className="text-[10px] text-white/90 leading-tight">{nid.district}</p>
                )}
              </div>
            </div>

            {/* Sex + Issue Date row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">Sex / लिङ्ग</p>
                {loading || !showData ? (
                  <div className="h-3 w-8 bg-white/15 rounded animate-pulse mt-0.5" />
                ) : (
                  <p className="text-[10px] text-white/90 leading-tight">{nid.gender === "F" ? "F" : nid.gender === "O" ? "O" : "M"}</p>
                )}
              </div>
              <div className="flex-1">
                <p className="text-[6px] text-white/50 uppercase tracking-wider leading-none">Issued / जारी</p>
                {loading || !showData ? (
                  <div className="h-3 w-14 bg-white/15 rounded animate-pulse mt-0.5" />
                ) : (
                  <p className="text-[10px] text-white/90 leading-tight">{nid.issueDate}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Linked UPA Badge */}
        {showData && !loading && nid.linkedUPA && (
          <div className="relative z-10 mx-4 mt-1">
            <div className="flex items-center gap-1 bg-white/10 rounded px-2 py-[2px] w-fit">
              <Shield className="h-2.5 w-2.5 text-green-400" />
              <span className="text-[7px] text-green-300 font-mono">{nid.linkedUPA}</span>
            </div>
          </div>
        )}

        {/* MRZ Zone (bottom) */}
        <div className="relative z-10 mx-3 mt-1.5 mb-2 bg-black/30 rounded px-2 py-1">
          {loading || !showData ? (
            <div className="space-y-1">
              <div className="h-2 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-2 w-3/4 bg-white/10 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-[7px] font-mono text-white/40 leading-tight tracking-[0.15em] truncate">{mrzLine1}</p>
              <p className="text-[7px] font-mono text-white/40 leading-tight tracking-[0.15em] truncate">{mrzLine2}</p>
            </>
          )}
        </div>

        {/* Hologram effect overlay */}
        <div className="absolute top-2 right-2 w-10 h-10 rounded-full z-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Verified stamp (bottom-right corner) */}
        {showData && !loading && (
          <div className="absolute bottom-6 right-3 z-20 opacity-30 rotate-[-15deg]">
            <div className="border-2 border-green-400 rounded-full px-2 py-0.5">
              <span className="text-[8px] font-bold text-green-400 tracking-wider">VERIFIED</span>
            </div>
          </div>
        )}
      </div>

      {/* "Fetched from Database" indicator below card */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-muted-foreground">
          {loading ? "Fetching from National ID Database..." : "Data retrieved from NID Registry API"}
        </span>
      </div>
    </div>
  );
}

/**
 * Loading skeleton version of the NID card
 */
export function NIDCardSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-lg border border-gray-200 animate-pulse"
        style={{ aspectRatio: "85.6 / 54", background: "linear-gradient(135deg, #1a237e 0%, #283593 30%, #1565c0 60%, #1976d2 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`,
        }} />

        {/* Top header shimmer */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/15" />
            <div className="space-y-1">
              <div className="h-2 w-12 bg-white/15 rounded" />
              <div className="h-1.5 w-16 bg-white/10 rounded" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <div className="h-2.5 w-16 bg-white/15 rounded ml-auto" />
            <div className="h-1.5 w-12 bg-white/10 rounded ml-auto" />
          </div>
        </div>

        <div className="relative z-10 mx-3 h-[1px] bg-white/10" />

        {/* Body shimmer */}
        <div className="relative z-10 flex gap-3 px-4 pt-2 pb-1">
          <div className="w-[72px] h-[88px] rounded-md bg-white/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
          </div>
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2 w-20 bg-white/10 rounded" />
            <div className="h-3.5 w-28 bg-white/15 rounded" />
            <div className="h-2 w-12 bg-white/10 rounded" />
            <div className="h-3.5 w-32 bg-white/15 rounded" />
            <div className="flex gap-3">
              <div className="h-3 w-16 bg-white/10 rounded" />
              <div className="h-3 w-16 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        {/* MRZ shimmer */}
        <div className="relative z-10 mx-3 mt-2 mb-2 bg-black/20 rounded px-2 py-1.5">
          <div className="h-2 w-full bg-white/10 rounded mb-1" />
          <div className="h-2 w-3/4 bg-white/10 rounded" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2">
        <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
        <span className="text-[10px] text-muted-foreground">Querying National ID Database...</span>
      </div>
    </div>
  );
}
