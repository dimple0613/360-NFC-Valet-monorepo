import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/theme";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";

type Props = RootStackScreenProps<"DriverCarDetails">;

const BackIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

const NfcSmallIcon = () => (
  <Svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FF8A50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2.5" width="16" height="19" rx="3" />
    <Path d="M9.5 9.5a4.2 4.2 0 0 1 5 0" />
    <Path d="M8 7a7 7 0 0 1 8 0" />
    <Circle cx="12" cy="13.5" r="1.4" fill="#FF8A50" stroke="none" />
  </Svg>
);

const CameraIcon = () => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F4531F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <Circle cx="12" cy="13" r="3" />
  </Svg>
);

const COLORS = [
  { id: "1", name: "Black", bg: "#16181C" },
  { id: "2", name: "White", bg: "#FFFFFF", border: "#E7EAF0" },
  { id: "3", name: "Silver", bg: "#C7CCD6" },
  { id: "4", name: "Grey", bg: "#7A8699" },
  { id: "5", name: "Maroon", bg: "#8E2C2C" },
  { id: "6", name: "Blue", bg: "#2C4E8E" },
];

const COLOR_MAP: Record<string, string> = {
  black: "1",
  white: "2",
  silver: "3",
  grey: "4",
  gray: "4",
  maroon: "5",
  red: "5",
  blue: "6",
  dark: "1",
  beige: "3",
  brown: "5",
};

const DriverCarDetails = ({ navigation, route }: Props) => {
  const { cardUid } = route.params;
  const isSerial = cardUid.includes(":") || cardUid.length > 6;
  const [plate, setPlate] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [selectedColor, setSelectedColor] = useState("1");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [cardNotFound, setCardNotFound] = useState(false);
  const [manualCardNumber, setManualCardNumber] = useState("");

  const handleScanPlate = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.error("Camera access needed", "Allow camera access to snap the plate.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.3,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;

    setScanning(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        toast.error("Error", "Failed to process image");
        setScanning(false);
        return;
      }
      const res = await http.post<{ plate: string | null; make: string | null; model: string | null; color: string | null }>(
        ApiEndpoints.driver.scanPlate,
        { image: manipulated.base64 },
      );
      if (res.plate) setPlate(res.plate);
      if (res.make) setCarMake(res.make);
      if (res.model) setCarModel(res.model);
      if (res.color) {
        const lower = res.color.toLowerCase();
        const match = COLOR_MAP[lower];
        if (match) setSelectedColor(match);
      }
      if (!res.plate && !res.make) {
        toast.info("Couldn't read", "Try again with a clearer photo of the plate.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Scan failed";
      toast.error("Error", message);
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = async (retryCardNumber?: string) => {
    if (!plate.trim()) {
      toast.error("Plate required", "Enter the plate number.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string | boolean> = {
        plate: plate.trim(),
      };
      const make = carMake.trim();
      const model = carModel.trim();
      const color = COLORS.find((c) => c.id === selectedColor)?.name;
      if (make) payload.carMake = make;
      if (model) payload.carModel = model;
      if (color) payload.carColor = color;
      if (retryCardNumber) {
        payload.cardNumber = retryCardNumber;
        payload.createCard = true;
        if (cardUid) payload.cardUid = cardUid;
      } else {
        payload.cardUid = cardUid;
      }
      const res = await http.post<{ orderId: number; createdAt: string; cardNumber?: string }>(
        ApiEndpoints.driver.orders,
        payload,
      );
      if (res.cardNumber) {
        toast.info(`Card #${res.cardNumber} registered`, "Write this number on the card so guests can tap it on the web page.");
      }
      navigation.replace("DriverCardActivated", {
        orderId: res.orderId,
        plate: plate.trim(),
        carDesc: [COLORS.find((c) => c.id === selectedColor)?.name, carMake, carModel].filter(Boolean).join(" "),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create order";
      if (!retryCardNumber && message.toLowerCase().includes("not found")) {
        setCardNotFound(true);
      } else {
        toast.error("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualCardSubmit = () => {
    const num = manualCardNumber.trim();
    if (!/^\d{4}$/.test(num)) {
      toast.error("Enter card number", "Type the 4-digit number printed on the card.");
      return;
    }
    setCardNotFound(false);
    handleConfirm(num);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Car details</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Card read ✓</Text>
          </View>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          <View style={styles.uidCard}>
            <View style={styles.uidLeft}>
              <Text style={styles.uidLabel}>{isSerial ? "SERIAL NUMBER — chip ID" : "CARD NUMBER — printed on card"}</Text>
              {isSerial ? (
                <Text style={styles.uidSerialText}>{cardUid}</Text>
              ) : (
                <View style={styles.uidDigits}>
                  {cardUid.split("").map((digit, i) => (
                    <View
                      key={i}
                      style={[
                        styles.uidDigitBox,
                        cardUid.length <= 4 && i === cardUid.length - 1 && styles.uidDigitBoxActive,
                      ]}
                    >
                      <Text style={styles.uidDigitText}>{digit.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <NfcSmallIcon />
          </View>

          <View style={[styles.plateCard, focusedField === "plate" && styles.plateCardFocused]}>
            <View style={styles.plateLeft}>
              <Text style={styles.fieldLabel}>PLATE NUMBER</Text>
              <TextInput
                style={styles.textInput}
                value={plate}
                onChangeText={setPlate}
                placeholder="e.g. DXB J 5580"
                placeholderTextColor="#9AA6BC"
                autoCapitalize="characters"
                onFocus={() => setFocusedField("plate")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <TouchableOpacity activeOpacity={0.7} onPress={handleScanPlate} disabled={scanning}>
              <View style={styles.carIconTile}>
                {scanning ? (
                  <ActivityIndicator size="small" color="#F4531F" />
                ) : (
                  <CameraIcon />
                )}
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.hintText}>Or snap the plate — we read it for you.</Text>

          <View style={styles.makeModelGrid}>
            <View style={[styles.fieldCard, { flex: 1 }, focusedField === "make" && styles.fieldCardFocused]}>
              <Text style={styles.fieldLabel}>MAKE</Text>
              <TextInput
                style={styles.textInput}
                value={carMake}
                onChangeText={setCarMake}
                placeholder="e.g. Mercedes"
                placeholderTextColor="#9AA6BC"
                onFocus={() => setFocusedField("make")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <View style={[styles.fieldCard, { flex: 1 }, focusedField === "model" && styles.fieldCardFocused]}>
              <Text style={styles.fieldLabel}>MODEL</Text>
              <TextInput
                style={styles.textInput}
                value={carModel}
                onChangeText={setCarModel}
                placeholder="e.g. G63"
                placeholderTextColor="#9AA6BC"
                onFocus={() => setFocusedField("model")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>COLOR</Text>
            <View style={styles.colorSwatches}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  onPress={() => setSelectedColor(color.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color.bg },
                      selectedColor === color.id
                        ? { borderWidth: 3, borderColor: "#F4531F" }
                        : color.border
                          ? { borderWidth: 1.5, borderColor: color.border }
                          : undefined,
                    ]}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.colorName}>{COLORS.find((c) => c.id === selectedColor)?.name}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleConfirm()}
            disabled={loading}
          >
            <View style={[styles.nextButton, loading && { opacity: 0.7 }]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.nextButtonText}>Activate card &amp; hand to guest</Text>
              )}
            </View>
          </TouchableOpacity>

          {cardNotFound && (
            <View style={styles.cardNotFoundBox}>
              <Text style={styles.cardNotFoundTitle}>First time with this card</Text>
              <Text style={styles.cardNotFoundHint}>
                This card isn't registered yet. Type the 4-digit number printed on it — just once. If it's a brand-new card we'll add it to the system, and we'll remember this chip from now on.
              </Text>
              <View style={styles.cardNumberRow}>
                <TextInput
                  style={styles.cardNumberInput}
                  value={manualCardNumber}
                  onChangeText={setManualCardNumber}
                  placeholder="e.g. 7001"
                  placeholderTextColor="#9AA6BC"
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                />
                <TouchableOpacity activeOpacity={0.8} onPress={handleManualCardSubmit} disabled={loading}>
                  <View style={styles.cardNumberSubmit}>
                    <Text style={styles.cardNumberSubmitText}>Go</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C2B46",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#E7F7EF",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0C9D61",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  uidCard: {
    backgroundColor: "#1C2B46",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
  },
  uidLeft: {
    flex: 1,
  },
  uidLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#9FB0CC",
    textTransform: "uppercase",
  },
  uidSerialText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 10,
  },
  uidDigits: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  uidDigitBox: {
    width: 36,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  uidDigitBoxActive: {
    borderWidth: 2,
    borderColor: "#F4531F",
  },
  uidDigitText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  plateCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  plateCardFocused: {
    borderWidth: 2,
    borderColor: "#F4531F",
  },
  plateLeft: {
    flex: 1,
  },
  carIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FEEFE8",
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontSize: 11,
    color: "#6C7A93",
    fontWeight: "600",
    marginTop: -6,
    paddingLeft: 4,
  },
  fieldCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  fieldCardFocused: {
    borderWidth: 2,
    borderColor: "#F4531F",
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#6C7A93",
    textTransform: "uppercase",
  },
  textInput: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
    color: "#1C2B46",
    padding: 0,
  },
  makeModelGrid: {
    flexDirection: "row",
    gap: 12,
  },
  colorSwatches: {
    flexDirection: "row",
    gap: 9,
    marginTop: 9,
    alignItems: "center",
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  colorName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6C7A93",
    marginLeft: 2,
  },
  nextButton: {
    backgroundColor: "#F4531F",
    borderRadius: 99,
    padding: 17,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#F4531F",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cardNotFoundBox: {
    backgroundColor: "#FFF8F5",
    borderWidth: 1.5,
    borderColor: "#F4531F",
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  cardNotFoundTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F4531F",
  },
  cardNotFoundHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6C7A93",
    marginTop: 4,
  },
  cardNumberRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 12,
  },
  cardNumberInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#1C2B46",
    letterSpacing: 2,
  },
  cardNumberSubmit: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F4531F",
    alignItems: "center",
    justifyContent: "center",
  },
  cardNumberSubmitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});

export default DriverCarDetails;
