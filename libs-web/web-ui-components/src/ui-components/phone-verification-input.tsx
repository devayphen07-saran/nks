"use client"

import * as React from "react"
import { CheckCircle2 } from "lucide-react"
import { cn } from "../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { 
  InputOTP, 
  InputOTPGroup, 
  InputOTPSlot 
} from "../ui/input-otp"

interface PhoneVerificationInputProps {
  phone: string;
  setPhone: (val: string) => void;
  otp: string;
  setOtp: (val: string) => void;
  otpSent: boolean;
  phoneVerified: boolean;
  onSendOtp: () => void;
  onConfirmOtp: () => void;
  onResendOtp: () => void;
  className?: string;
}

export function PhoneVerificationInput({
  phone,
  setPhone,
  otp,
  setOtp,
  otpSent,
  phoneVerified,
  onSendOtp,
  onConfirmOtp,
  onResendOtp,
  className
}: PhoneVerificationInputProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor="phone" className="font-semibold text-sm">Phone Number</Label>
      <div className="flex gap-2">
        <div className="flex h-12 items-center rounded-md border border-muted-foreground/20 bg-muted/50 px-4 text-sm font-bold text-foreground">
          +91
        </div>
        <Input
          id="phone"
          type="tel"
          placeholder="98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={cn(
            "h-12 flex-1 shadow-sm border-muted-foreground/20 focus:border-primary transition-colors font-medium", 
            phoneVerified && "border-green-500/50 bg-green-50/10"
          )}
          disabled={otpSent || phoneVerified}
        />
        {!phoneVerified && !otpSent && (
          <Button
            type="button"
            variant="outline"
            onClick={onSendOtp}
            className="h-12 px-6 font-bold border-primary text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            Verify
          </Button>
        )}
        {phoneVerified && (
          <div className="flex h-12 items-center gap-2 px-4 rounded-md border border-green-500/30 bg-green-50 text-green-600 font-bold text-sm whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4" />
            Verified
          </div>
        )}
      </div>

      {otpSent && !phoneVerified && (
        <div className="grid gap-4 mt-4 p-6 rounded-xl border border-muted-foreground/10 bg-muted/20">
          <div className="grid gap-3 items-center justify-center text-center">
            <div className="space-y-1">
              <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Verification Code</Label>
              <p className="text-xs text-muted-foreground">Sent to registered mobile number</p>
            </div>
            <InputOTP 
              maxLength={6} 
              autoFocus 
              value={otp}
              onChange={(val) => setOtp(val)}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <InputOTPSlot key={idx} index={idx} className="h-12 w-10 border-muted-foreground/30 rounded-md bg-background" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-sm text-muted-foreground mt-1">
              Didn&apos;t receive code?{" "}
              <button
                type="button"
                onClick={onResendOtp}
                className="text-primary font-bold hover:underline"
              >
                Resend
              </button>
            </p>
          </div>
          <Button
            type="button"
            onClick={onConfirmOtp}
            className="w-full h-11 font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all active:scale-[0.98]"
          >
            Confirm OTP
          </Button>
        </div>
      )}
    </div>
  )
}
