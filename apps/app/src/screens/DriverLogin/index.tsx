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
import { useAuth } from "../../context/AuthContext";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";
import { Formik } from "formik";
import * as Yup from "yup";

type Props = RootStackScreenProps<"DriverLogin">;

const DriverLogin = ({ navigation }: Props) => {
  const { signIn } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

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

          <View style={styles.content}>
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              colors={["#F4531F", "#FF8A50"]}
              style={styles.logo}
            >
              <Svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M6 8a7 7 0 0 1 0 8" />
                <Path d="M9.5 5.5a11 11 0 0 1 0 13" />
                <Path d="M13 3a15 15 0 0 1 0 18" />
              </Svg>
            </LinearGradient>

            <Text style={styles.title}>360 NFC Valet</Text>
            <Text style={styles.subtitle}>
              Driver console. Sign in to start your shift.
            </Text>

            <Formik
              initialValues={{ valetId: "", password: "" }}
              validationSchema={Yup.object({
                valetId: Yup.string()
                  .trim()
                  .required("Please enter your Driver ID."),
                password: Yup.string()
                  .trim()
                  .required("Please enter your password."),
              })}
              onSubmit={async (values, { setSubmitting }) => {
                setLoading(true);
                try {
                  await signIn(values.valetId.trim(), values.password.trim());
                } catch (err: unknown) {
                  const message =
                    err instanceof Error ? err.message : "Login failed";
                  toast.error("Sign in failed", message);
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
                <>
                  <View style={styles.form}>
                    <View>
                      <View style={styles.inputField}>
                        <Text style={styles.inputLabel}>DRIVER ID</Text>
                        <TextInput
                          style={styles.textInput}
                          value={values.valetId}
                          onChangeText={handleChange("valetId")}
                          onBlur={handleBlur("valetId")}
                          placeholder="e.g. VD-0248"
                          placeholderTextColor="#9AA6BC"
                          autoCapitalize="characters"
                        />
                      </View>
                      {touched.valetId && errors.valetId && (
                        <Text style={styles.fieldError}>{errors.valetId}</Text>
                      )}
                    </View>

                    <View>
                      <View style={styles.inputFieldRow}>
                        <View style={styles.inputFieldLeft}>
                          <Text style={styles.inputLabel}>PASSWORD</Text>
                          <TextInput
                            style={styles.textInputPassword}
                            value={values.password}
                            onChangeText={handleChange("password")}
                            onBlur={handleBlur("password")}
                            placeholder="Enter your password"
                            placeholderTextColor="#9AA6BC"
                            secureTextEntry={!passwordVisible}
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => setPasswordVisible(!passwordVisible)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#6C7A93"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <Path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
                            <Circle cx="12" cy="12" r="2.6" />
                          </Svg>
                        </TouchableOpacity>
                      </View>
                      {touched.password && errors.password && (
                        <Text style={styles.fieldError}>{errors.password}</Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.forgotPassword}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("DriverForgotPassword")}
                  >
                    <Text style={styles.forgotPasswordText}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.footer}>
                    <TouchableOpacity
                      onPress={() => handleSubmit()}
                      activeOpacity={0.8}
                      disabled={loading || isSubmitting}
                    >
                      <LinearGradient
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        colors={["#F4531F", "#FF8A50"]}
                        style={[
                          styles.signInButton,
                          (loading || isSubmitting) && { opacity: 0.7 },
                        ]}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.signInText}>Sign in</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <Text style={styles.footerNote}>
                      Accounts are created by your admin — no self sign-up.
                    </Text>
                  </View>
                </>
              )}
            </Formik>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 34,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F4531F",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C2B46",
    letterSpacing: -0.5,
    marginTop: 26,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6C7A93",
    marginTop: 6,
  },
  form: {
    marginTop: 34,
    gap: 14,
  },
  inputField: {
    backgroundColor: "#F6F7F9",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#6C7A93",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  textInput: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1C2B46",
    marginTop: 2,
    padding: 0,
  },
  textInputPassword: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#1C2B46",
    marginTop: 2,
    padding: 0,
  },
  inputFieldRow: {
    backgroundColor: "#F6F7F9",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputFieldLeft: {
    flex: 1,
  },
  forgotPassword: {
    alignItems: "flex-end",
    marginTop: 14,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F4531F",
  },
  footer: {
    marginTop: "auto" as const,
  },
  signInButton: {
    alignItems: "center",
    borderRadius: 99,
    paddingVertical: 17,
    shadowColor: "#F4531F",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  footerNote: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6C7A93",
    textAlign: "center",
    marginTop: 14,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E53E3E",
    marginTop: 6,
    marginLeft: 4,
  },
});

export default DriverLogin;
