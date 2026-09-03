import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/theme";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";
import { Formik } from "formik";
import * as Yup from "yup";

type Props = RootStackScreenProps<"DriverCardActivated">;

const CheckIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12.5 9.5 18 20 6.5" />
  </Svg>
);

const DriverCardActivated = ({ navigation, route }: Props) => {
  const { orderId, plate, carDesc } = route.params;
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <Formik
          initialValues={{ floor: "", zone: "", parkingNum: "" }}
          validationSchema={Yup.object({
            floor: Yup.string().trim().required("Enter floor."),
            zone: Yup.string().trim().required("Enter zone."),
            parkingNum: Yup.string().trim().required("Enter parking number."),
          })}
          onSubmit={async (values, { setSubmitting }) => {
            setLoading(true);
            try {
              await http.patch<{ ok: boolean }>(
                ApiEndpoints.driver.orderStatus(orderId),
                {
                  status: "parked",
                  zone: `${values.floor.trim()} · ${values.zone.trim()} · ${values.parkingNum.trim()}`,
                  slot: values.parkingNum.trim(),
                },
              );
              navigation.navigate("DriverHome");
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Failed to update";
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
            isSubmitting,
          }) => (
            <>
              <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
                <View style={styles.successBanner}>
                  <View style={styles.checkCircle}>
                    <CheckIcon />
                  </View>
                  <View style={styles.bannerTextWrap}>
                    <Text style={styles.successTitle}>Card activated</Text>
                    <Text style={styles.successSubtitle}>Hand the card to the guest — {"\n"}they&apos;re all set.</Text>
                  </View>
                </View>

                <View style={styles.carInfoCard}>
                  <View>
                    <Text style={styles.carPlate}>{plate}</Text>
                    <Text style={styles.carDesc}>{carDesc}</Text>
                  </View>
                  <View style={styles.toParkBadge}>
                    <Text style={styles.toParkBadgeText}>To park</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Where did you park it?</Text>
                <Text style={styles.helperText}>Type it exactly as you&apos;d say it — this keeps retrieval under 2 minutes.</Text>

                <View style={styles.fieldsContainer}>
                  <View>
                    <Text style={styles.fieldLabel}>FLOOR</Text>
                    <TextInput
                      style={[styles.textInput, focusedField === "floor" && styles.textInputFocused]}
                      value={values.floor}
                      onChangeText={handleChange("floor")}
                      onBlur={() => { handleBlur("floor"); setFocusedField(null); }}
                      placeholder="e.g. B2"
                      placeholderTextColor="#9AA6BC"
                      autoCapitalize="characters"
                      onFocus={() => setFocusedField("floor")}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>ZONE</Text>
                    <TextInput
                      style={[styles.textInput, focusedField === "zone" && styles.textInputFocused]}
                      value={values.zone}
                      onChangeText={handleChange("zone")}
                      onBlur={() => { handleBlur("zone"); setFocusedField(null); }}
                      placeholder="e.g. Zone B"
                      placeholderTextColor="#9AA6BC"
                      autoCapitalize="characters"
                      onFocus={() => setFocusedField("zone")}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>PARKING NUMBER</Text>
                    <View style={[styles.inputWithHint, focusedField === "parking" && styles.inputWithHintFocused]}>
                      <TextInput
                        style={styles.textInputInner}
                        value={values.parkingNum}
                        onChangeText={handleChange("parkingNum")}
                        onBlur={() => { handleBlur("parkingNum"); setFocusedField(null); }}
                        placeholder=""
                        placeholderTextColor="#9AA6BC"
                        autoCapitalize="characters"
                        onFocus={() => setFocusedField("parking")}
                      />
                      {!values.parkingNum ? (
                        <Text style={styles.inputHint}>e.g. 42, P-108</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.bottomButtonContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSubmit()}
                  disabled={loading || isSubmitting}
                >
                  <View style={[styles.closeButton, (loading || isSubmitting) && { opacity: 0.7 }]}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.closeButtonText}>
                        {values.floor && values.zone && values.parkingNum
                          ? `Parked at ${values.floor} · ${values.zone} · ${values.parkingNum} — Close order`
                          : "Close order"}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Formik>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
  },
  successBanner: {
    backgroundColor: "#E7F7EF",
    borderWidth: 1.5,
    borderColor: "#BFE9D4",
    borderRadius: 18,
    padding: 15,
    paddingRight: 18,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
  },
  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0C9D61",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerTextWrap: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0A7C4E",
  },
  successSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3E8A67",
    marginTop: 1,
  },
  carInfoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 18,
    padding: 16,
    paddingRight: 18,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carPlate: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1C2B46",
  },
  carDesc: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C7A93",
    marginTop: 2,
  },
  toParkBadge: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#FEEFE8",
  },
  toParkBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#D6430F",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C2B46",
    marginTop: 20,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6C7A93",
    marginBottom: 8,
  },
  fieldsContainer: {
    gap: 12,
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#6C7A93",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 14,
    padding: 14,
    paddingLeft: 16,
    fontSize: 15,
    fontWeight: "700",
    color: "#1C2B46",
  },
  textInputFocused: {
    borderWidth: 2,
    borderColor: "#F4531F",
  },
  inputWithHint: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputWithHintFocused: {
    borderWidth: 2,
    borderColor: "#F4531F",
  },
  textInputInner: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#1C2B46",
    padding: 0,
  },
  inputHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9AA6BC",
  },
  bottomButtonContainer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 34,
  },
  closeButton: {
    backgroundColor: "#1C2B46",
    borderRadius: 99,
    padding: 17,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});

export default DriverCardActivated;
