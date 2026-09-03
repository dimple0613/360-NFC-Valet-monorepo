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
import Svg, { Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";
import { Formik } from "formik";
import * as Yup from "yup";

type Props = RootStackScreenProps<"DriverResetPassword">;

const BackIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

const EyeIcon = ({ open }: { open: boolean }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C7A93" strokeWidth="2" strokeLinecap="round">
    {open ? (
      <>
        <Path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
        <Circle cx="12" cy="12" r="2.6" />
      </>
    ) : (
      <>
        <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <Path d="M2 2l20 20" />
      </>
    )}
  </Svg>
);

const DriverResetPassword = ({ navigation, route }: Props) => {
  const { token } = route.params;
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

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
            initialValues={{ password: "", confirmPassword: "" }}
            validationSchema={Yup.object({
              password: Yup.string()
                .trim()
                .min(6, "Password must be at least 6 characters.")
                .required("Enter a new password."),
              confirmPassword: Yup.string()
                .oneOf([Yup.ref("password")], "Passwords do not match.")
                .required("Confirm your password."),
            })}
            onSubmit={async (values, { setSubmitting }) => {
              setLoading(true);
              try {
                await http.post<{ ok: boolean }>(
                  ApiEndpoints.auth.driverResetPassword,
                  { token, password: values.password.trim() },
                );
                toast.success(
                  "Success",
                  "Your password has been reset. You can now sign in.",
                );
                navigation.navigate("DriverLogin");
              } catch (err: unknown) {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Failed to reset password";
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
                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>
                  Enter your new password below.
                </Text>

                <View style={styles.inputFieldRow}>
                  <View style={styles.inputFieldLeft}>
                    <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                    <TextInput
                      style={styles.textInput}
                      value={values.password}
                      onChangeText={handleChange("password")}
                      onBlur={handleBlur("password")}
                      placeholder="At least 6 characters"
                      placeholderTextColor="#9AA6BC"
                      secureTextEntry={!passwordVisible}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => setPasswordVisible((v) => !v)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <EyeIcon open={passwordVisible} />
                  </TouchableOpacity>
                </View>
                {touched.password && errors.password && (
                  <Text style={styles.fieldError}>{errors.password}</Text>
                )}

                <View style={styles.inputFieldRow}>
                  <View style={styles.inputFieldLeft}>
                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <TextInput
                      style={styles.textInput}
                      value={values.confirmPassword}
                      onChangeText={handleChange("confirmPassword")}
                      onBlur={handleBlur("confirmPassword")}
                      placeholder="Re-enter password"
                      placeholderTextColor="#9AA6BC"
                      secureTextEntry={!passwordVisible}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => setPasswordVisible((v) => !v)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <EyeIcon open={passwordVisible} />
                  </TouchableOpacity>
                </View>
                {touched.confirmPassword && errors.confirmPassword && (
                  <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
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
                      <Text style={styles.submitText}>Reset password</Text>
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
  inputField: { backgroundColor: "#F6F7F9", borderWidth: 1.5, borderColor: "#E7EAF0", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, marginTop: 22 },
  inputFieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F6F7F9", borderWidth: 1.5, borderColor: "#E7EAF0", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, marginTop: 22 },
  inputFieldLeft: { flex: 1 },
  inputLabel: { fontSize: 10.5, fontWeight: "800", color: "#6C7A93", letterSpacing: 1.5, textTransform: "uppercase" },
  textInput: { fontSize: 15.5, fontWeight: "700", color: "#1C2B46", marginTop: 2, padding: 0 },
  submitButton: { alignItems: "center", borderRadius: 99, paddingVertical: 17, marginTop: 28 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  fieldError: { fontSize: 12, fontWeight: "600", color: "#E53E3E", marginTop: 6, marginLeft: 4 },
});

export default DriverResetPassword;
