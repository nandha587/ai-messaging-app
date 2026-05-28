// src/screens/auth/PhoneLoginScreen.jsx
// Phone number login with country picker and Firebase OTP

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// react-native-country-picker-modal removed — simple inline stub
const CountryPicker = ({ countryCode, withFlag, withCallingCode, onSelect, visible }) => null;
import { signInWithPhoneNumber } from '../../services/firebase';

const { width, height } = Dimensions.get('window');

// ─── Toast-style inline alert ─────────────────────────────────────────────────
function InlineAlert({ message, type }) {
  if (!message) return null;
  const bgColor = type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
  const borderColor = type === 'error' ? '#EF4444' : '#22C55E';
  const textColor = type === 'error' ? '#F87171' : '#4ADE80';
  return (
    <View style={[styles.alert, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.alertText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

export default function PhoneLoginScreen({ navigation }) {
  const [countryCode, setCountryCode] = useState('US');
  const [callingCode, setCallingCode] = useState('1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('error');

  const phoneInputRef = useRef(null);

  const showAlert = (message, type = 'error') => {
    setAlertMsg(message);
    setAlertType(type);
    if (type !== 'error') {
      setTimeout(() => setAlertMsg(''), 4000);
    }
  };

  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 7 && cleaned.length <= 15;
  };

  const handleSendOTP = async () => {
    setAlertMsg('');
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (!validatePhone(cleaned)) {
      showAlert('Please enter a valid phone number.');
      return;
    }

    const fullPhone = `+${callingCode}${cleaned}`;
    setIsLoading(true);

    try {
      // Note: RecaptchaVerifier requires web environment.
      // In a real Expo app, use firebase/auth/react-native with
      // FirebaseRecaptchaVerifierModal from expo-firebase-recaptcha.
      // Here we pass null as a placeholder for the recaptchaVerifier.
      const confirmResult = await signInWithPhoneNumber(fullPhone, null);
      navigation.navigate('OTPVerify', { confirmResult, phone: fullPhone });
    } catch (error) {
      console.error('[PhoneLogin] Error:', error);
      let message = 'Failed to send OTP. Please try again.';
      if (error.code === 'auth/invalid-phone-number') {
        message = 'Invalid phone number format.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many requests. Please wait before trying again.';
      } else if (error.message) {
        message = error.message;
      }
      showAlert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSelectCountry = (country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
    setShowCountryPicker(false);
  };

  const isValid = phoneNumber.replace(/\D/g, '').length >= 7;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient
        colors={['#0F0F1A', '#130D2A', '#0F0F1A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative glow */}
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
          {/* ── Logo ── */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={['#7C3AED', '#DB2777']}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logoEmoji}>💬</Text>
            </LinearGradient>
            <Text style={styles.brandName}>AI Chat</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to get started
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Phone Number</Text>

            {/* Country + Phone row */}
            <View style={styles.phoneRow}>
              {/* Country picker button */}
              <TouchableOpacity
                style={styles.countryButton}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.75}
              >
                <CountryPicker
                  countryCode={countryCode}
                  withFlag
                  withCallingCode
                  withFilter
                  visible={showCountryPicker}
                  onSelect={onSelectCountry}
                  onClose={() => setShowCountryPicker(false)}
                  containerButtonStyle={styles.countryPickerContainer}
                  theme={{
                    backgroundColor: '#1A1A2E',
                    onBackgroundTextColor: '#FFFFFF',
                    primaryColor: '#7C3AED',
                    primaryColorVariant: '#5B21B6',
                    filterPlaceholderTextColor: '#606080',
                    activeOpacity: 0.7,
                    itemHeight: 48,
                    flagSize: 24,
                    fontSize: 15,
                    fontFamily: undefined,
                  }}
                />
                <Text style={styles.callingCode}>+{callingCode}</Text>
                <Text style={styles.dropdownChevron}>▾</Text>
              </TouchableOpacity>

              {/* Phone number input */}
              <TextInput
                ref={phoneInputRef}
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={(t) => {
                  setPhoneNumber(t);
                  if (alertMsg) setAlertMsg('');
                }}
                placeholder="Phone number"
                placeholderTextColor="#505070"
                keyboardType="phone-pad"
                maxLength={15}
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
              />
            </View>

            {/* Alert */}
            <InlineAlert message={alertMsg} type={alertType} />

            {/* Send OTP button */}
            <TouchableOpacity
              onPress={handleSendOTP}
              activeOpacity={0.85}
              disabled={isLoading || !isValid}
              style={[styles.sendButtonWrapper, (!isValid || isLoading) && styles.sendButtonDisabled]}
            >
              <LinearGradient
                colors={isValid && !isLoading ? ['#7C3AED', '#DB2777'] : ['#3A2060', '#5A1840']}
                style={styles.sendButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>Send OTP →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  glowTop: {
    position: 'absolute',
    top: -80,
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
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoEmoji: {
    fontSize: 36,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#A0A0C0',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A45',
    gap: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252540',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#333360',
  },
  countryPickerContainer: {
    margin: 0,
    padding: 0,
  },
  callingCode: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#A0A0C0',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#252540',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333360',
  },
  alert: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sendButtonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  terms: {
    marginTop: 24,
    fontSize: 12,
    color: '#505070',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#9D5FF5',
    fontWeight: '600',
  },
});
