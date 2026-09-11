import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Text, TextInput } from "@/theme";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";
import { Formik } from "formik";
import * as Yup from "yup";

type Props = RootStackScreenProps<"DriverForgotPassword">;

const BackIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

const DriverForgotPassword = ({ navigation }: Props) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.flex}>
          <MobileStatusBar />
          <View style={styles.centerContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successText}>✓</Text>
            </View>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentSubtitle}>
              We've sent a password reset link to{"\n"}{submittedEmail}
            </Text>

            {resetToken && (
              <TouchableOpacity
                style={styles.devTokenButton}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("DriverResetPassword", { token: resetToken })}
              >
                <Text style={styles.devTokenText}>Continue with reset (dev)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.backToLogin}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("DriverLogin")}
            >
              <Text style={styles.backToLoginText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <MobileStatusBar />

          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>

          <Formik
            initialValues={{ email: "" }}
            validationSchema={Yup.object({
              email: Yup.string()
                .trim()
                .email("Enter a valid email address.")
                .required("Enter your registered email address."),
            })}
            onSubmit={async (values, { setSubmitting }) => {
              setLoading(true);
              try {
                const res = await http.post<{ ok: boolean; resetToken?: string }>(
                  ApiEndpoints.auth.driverForgotPassword,
                  { email: values.email.trim() },
                );
                if (res.resetToken) {
                  setResetToken(res.resetToken);
                }
                setSubmittedEmail(values.email.trim());
                setSent(true);
              } catch (err: unknown) {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Failed to send reset link";
                toast.error("Error", message);
              } finally {
                setLoading(false);
                setSubmitting(false);
              }
            }}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              isSubmitting,
            }) => (
              <View style={styles.content}>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>
                  Enter your email address and we'll send you a reset link.
                </Text>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.textInput}
                    value={values.email}
                    onChangeText={handleChange("email")}
                    onBlur={handleBlur("email")}
                    placeholder="you@360valet.com"
                    placeholderTextColor="#9AA6BC"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {touched.email && errors.email && (
                  <Text style={styles.fieldError}>{errors.email}</Text>
                )}

                <TouchableOpacity
                  onPress={() => handleSubmit()}
                  activeOpacity={0.8}
                  disabled={loading || isSubmitting}
                >
                  <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={["#F4531F", "#FF8A50"]}
                    style={[styles.submitButton, (loading || isSubmitting) && { opacity: 0.7 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>Send reset link</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F6F7F9", alignItems: "center", justifyContent: "center", marginLeft: 22, marginTop: 12 },
  content: { paddingHorizontal: 30, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: "800", color: "#1C2B46", letterSpacing: -0.4, lineHeight: 32 },
  subtitle: { fontSize: 14, fontWeight: "500", color: "#6C7A93", marginTop: 8, lineHeight: 20 },
  inputField: { backgroundColor: "#F6F7F9", borderWidth: 1.5, borderColor: "#E7EAF0", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, marginTop: 28 },
  inputLabel: { fontSize: 10.5, fontWeight: "800", color: "#6C7A93", letterSpacing: 1.5, textTransform: "uppercase" },
  textInput: { fontSize: 15.5, fontWeight: "700", color: "#1C2B46", marginTop: 2, padding: 0 },
  submitButton: { alignItems: "center", borderRadius: 99, paddingVertical: 17, marginTop: 24 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E7F7EF", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successText: { fontSize: 28, fontWeight: "800", color: "#0C9D61" },
  sentTitle: { fontSize: 22, fontWeight: "800", color: "#1C2B46", textAlign: "center" },
  sentSubtitle: { fontSize: 14, fontWeight: "500", color: "#6C7A93", textAlign: "center", marginTop: 8, lineHeight: 20 },
  devTokenButton: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, backgroundColor: "#F6F7F9", borderWidth: 1.5, borderColor: "#E7EAF0" },
  devTokenText: { fontSize: 13, fontWeight: "700", color: "#6C7A93" },
  backToLogin: { marginTop: 16 },
  backToLoginText: { fontSize: 14, fontWeight: "700", color: "#F4531F" },
  fieldError: { fontSize: 12, fontWeight: "600", color: "#E53E3E", marginTop: 6, marginLeft: 4 },
});

export default DriverForgotPassword;
