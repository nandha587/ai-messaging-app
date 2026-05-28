// src/screens/auth/OTPVerifyScreen.jsx
// 6-digit OTP verification with auto-advance and countdown resend

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

// ─── Single OTP digit box ─────────────────────────────────────────────────────
function OTPDigitBox({ value, isFocused, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.digitBox,
        value ? styles.digitBoxFilled : null,
        isFocused ? styles.digitBoxFocused : null,
      ]}
    >
      <Text style={styles.digitText}>{value || ''}</Text>
      {isFocused && !value && <View style={styles.cursor} />}
    </TouchableOpacity>
  );
}

export default function OTPVerifyScreen({ navigation, route }) {
  const { confirmResult, phone } = route.params || {};
  const { login } = useAuth();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);

  const hiddenInputRef = useRef(null);
  const countdownRef = useRef(null);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  // ── Auto-focus hidden input ───────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => hiddenInputRef.current?.focus(), 300);
  }, []);

  const getOTPString = useCallback(() => otp.join(''), [otp]);

  // ── Handle text change from hidden input ──────────────────────────────────
  const handleOTPChange = useCallback(
    (text) => {
      setErrorMsg('');
      // Remove non-digits
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const newOtp = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < cleaned.length; i++) {
        newOtp[i] = cleaned[i];
      }
      setOtp(newOtp);
      setFocusedIndex(Math.min(cleaned.length, OTP_LENGTH - 1));

      // Auto-submit when complete
      if (cleaned.length === OTP_LENGTH) {
        verifyOTP(cleaned);
      }
    },
    [confirmResult]
  );

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const verifyOTP = async (otpString) => {
    if (!confirmResult) {
      setErrorMsg('Session expired. Please go back and try again.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const userCredential = await confirmResult.confirm(otpString);
      const idToken = await userCredential.user.getIdToken();
      const { isNewUser } = await login(idToken);

      if (isNewUser) {
        navigation.replace('ProfileSetup');
      } else {
        navigation.replace('ChatList');
      }
    } catch (error) {
      console.error('[OTPVerify] Error:', error);
      setOtp(Array(OTP_LENGTH).fill(''));
      setFocusedIndex(0);
      hiddenInputRef.current?.clear();

      let message = 'Invalid OTP. Please try again.';
      if (error.code === 'auth/code-expired') {
        message = 'OTP has expired. Please resend.';
      } else if (error.code === 'auth/invalid-verification-code') {
        message = 'Incorrect code. Please check and try again.';
      }
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPress = () => {
    const otpString = getOTPString();
    if (otpString.length < OTP_LENGTH) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }
    verifyOTP(otpString);
  };

  const handleResend = async () => {
    if (!canResend) return;
    Alert.alert('Resend OTP', 'Please go back to the phone number screen to resend.', [
      { text: 'Go Back', onPress: () => navigation.goBack() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{1,3})(\d*)(\d{4})/, (_, cc, mid, last) => `${cc} ${'•'.repeat(mid.length)} ${last}`)
    : '';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient
        colors={['#0F0F1A', '#130D2A', '#0F0F1A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.glowTop} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#7C3AED', '#DB2777']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logoEmoji}>🔐</Text>
            </LinearGradient>
            <Text style={styles.title}>Verify Your Number</Text>
            <Text style={styles.description}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.phoneText}>{maskedPhone}</Text>
            </Text>
          </View>

          {/* OTP boxes (visual) */}
          <TouchableOpacity
            activeOpacity={1}
            style={styles.otpRow}
            onPress={() => hiddenInputRef.current?.focus()}
          >
            {Array(OTP_LENGTH)
              .fill(0)
              .map((_, i) => (
                <OTPDigitBox
                  key={i}
                  value={otp[i]}
                  isFocused={focusedIndex === i && !isLoading}
                  onPress={() => {
                    setFocusedIndex(i);
                    hiddenInputRef.current?.focus();
                  }}
                />
              ))}
          </TouchableOpacity>

          {/* Hidden real input */}
          <TextInput
            ref={hiddenInputRef}
            style={styles.hiddenInput}
            value={otp.join('')}
            onChangeText={handleOTPChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            caretHidden
            selectTextOnFocus={false}
          />

          {/* Error message */}
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Verify button */}
          <TouchableOpacity
            onPress={handleVerifyPress}
            activeOpacity={0.85}
            disabled={isLoading}
            style={styles.verifyButtonWrapper}
          >
            <LinearGradient
              colors={['#7C3AED', '#DB2777']}
              style={styles.verifyButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Code</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend section */}
          <View style={styles.resendSection}>
            {canResend ? (
              <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                <Text style={styles.resendActive}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendCountdown}>
                Resend in{' '}
                <Text style={styles.resendTimer}>
                  0:{String(countdown).padStart(2, '0')}
                </Text>
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const BOX_SIZE = Math.min((width - 48 - 50) / OTP_LENGTH, 52);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    left: width / 2 - 120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 20,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: '#A0A0C0',
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneText: {
    color: '#9D5FF5',
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  digitBox: {
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#333360',
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digitBoxFilled: {
    borderColor: '#7C3AED',
    backgroundColor: '#252540',
  },
  digitBoxFocused: {
    borderColor: '#9D5FF5',
    backgroundColor: '#252550',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 2,
    height: 22,
    backgroundColor: '#9D5FF5',
    borderRadius: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  verifyButtonWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
  },
  verifyButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  resendSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendCountdown: {
    fontSize: 14,
    color: '#606080',
  },
  resendTimer: {
    color: '#9D5FF5',
    fontWeight: '700',
  },
  resendActive: {
    fontSize: 14,
    color: '#9D5FF5',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
