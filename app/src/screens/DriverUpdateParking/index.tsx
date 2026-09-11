import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/theme";
import Svg, { Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";
import { Formik } from "formik";
import * as Yup from "yup";

type Props = RootStackScreenProps<"DriverUpdateParking">;

const BackIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

const CarIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
    <Path d="M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    <Circle cx="7.5" cy="17.5" r="1.6" />
    <Circle cx="16.5" cy="17.5" r="1.6" />
  </Svg>
);

const DriverUpdateParking = ({ navigation, route }: Props) => {
  const { orderId } = route.params;
  const { driver } = useAuth();
  const [loading, setLoading] = useState(false);

  const propertyName = driver?.propertyName ?? "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Update Parking</Text>
          <View style={styles.headerSpacer} />
        </View>

        {propertyName ? (
          <Text style={styles.propertyName}>{propertyName}</Text>
        ) : null}

        <Formik
          initialValues={{ zone: "", slot: "" }}
          validationSchema={Yup.object({
            zone: Yup.string().trim().required("Enter zone."),
            slot: Yup.string().trim().required("Enter slot."),
          })}
          onSubmit={async (values, { setSubmitting }) => {
            setLoading(true);
            try {
              await http.patch<{ ok: boolean }>(
                ApiEndpoints.driver.orderStatus(orderId),
                { status: "parked", zone: values.zone.trim(), slot: values.slot.trim() },
              );
              navigation.navigate("DriverHome");
            } catch (err: unknown) {
              const message =
                err instanceof Error
                  ? err.message
                  : "Failed to update parking";
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
                <View style={styles.orderCard}>
                  <View style={styles.orderCardLeft}>
                    <View style={styles.carIconTile}>
                      <CarIcon size={24} />
                    </View>
                    <View>
                      <Text style={styles.orderLabel}>ORDER</Text>
                      <Text style={styles.orderId}>#{orderId}</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>To park</Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Select parking location</Text>
                <Text style={styles.sectionHint}>Enter the zone and slot where you parked the car.</Text>

                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#E7EAF0" }]} />
                    <Text style={styles.legendText}>Occupied</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#E7F7EF" }]} />
                    <Text style={styles.legendText}>Available</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#F4531F" }]} />
                    <Text style={styles.legendText}>Selected</Text>
                  </View>
                </View>

                <View style={styles.fieldsRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>ZONE</Text>
                    <TextInput
                      style={styles.textInput}
                      value={values.zone}
                      onChangeText={handleChange("zone")}
                      onBlur={handleBlur("zone")}
                      placeholder="e.g. Zone B"
                      placeholderTextColor="#9AA6BC"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>SLOT</Text>
                    <TextInput
                      style={styles.textInput}
                      value={values.slot}
                      onChangeText={handleChange("slot")}
                      onBlur={handleBlur("slot")}
                      placeholder="e.g. 42"
                      placeholderTextColor="#9AA6BC"
                    />
                  </View>
                </View>

                <View style={styles.infoBanner}>
                  <View style={styles.infoDot} />
                  <Text style={styles.infoBannerText}>Order transitions to Parked on submission.</Text>
                </View>
              </ScrollView>

              <View style={styles.bottomContainer}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => handleSubmit()} disabled={loading || isSubmitting}>
                  <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={["#F4531F", "#FF8A50"]}
                    style={[styles.confirmButton, (loading || isSubmitting) && { opacity: 0.7 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirm & Close Order</Text>
                    )}
                  </LinearGradient>
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
  safe: { flex: 1, backgroundColor: "#F6F7F9" },
  flex: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingTop: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E7EAF0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#1C2B46" },
  headerSpacer: { width: 40 },
  propertyName: { fontSize: 12, fontWeight: "600", color: "#6C7A93", paddingHorizontal: 22, marginTop: 6 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 },
  orderCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 16, padding: 16 },
  orderCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  carIconTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F6F7F9", alignItems: "center", justifyContent: "center" },
  orderLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#6C7A93", textTransform: "uppercase" },
  orderId: { fontSize: 15, fontWeight: "800", color: "#1C2B46", marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: "#FEEFE8" },
  statusBadgeText: { fontSize: 11, fontWeight: "800", color: "#D6430F" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1C2B46", marginTop: 22, marginBottom: 4 },
  sectionHint: { fontSize: 12, fontWeight: "500", color: "#6C7A93" },
  legend: { flexDirection: "row", gap: 16, marginTop: 14, marginBottom: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, fontWeight: "600", color: "#6C7A93" },
  fieldsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, color: "#6C7A93", textTransform: "uppercase", marginBottom: 6 },
  textInput: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E7EAF0", borderRadius: 14, padding: 14, paddingLeft: 16, fontSize: 15, fontWeight: "700", color: "#1C2B46" },
  infoBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#E7F7EF", borderRadius: 12, padding: 12, paddingLeft: 14, marginTop: 18, gap: 8 },
  infoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0C9D61" },
  infoBannerText: { fontSize: 12, fontWeight: "600", color: "#0A7C4E" },
  bottomContainer: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 34 },
  confirmButton: { alignItems: "center", borderRadius: 99, paddingVertical: 17 },
  confirmButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});

export default DriverUpdateParking;
