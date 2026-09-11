import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/theme";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNfc } from "../../hooks/useNfc";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";

type Props = RootStackScreenProps<"DriverWriteCard">;

const BackIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

const NfcCardIcon = ({ size = 62 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2.5" width="16" height="19" rx="3" />
    <Path d="M9.5 9.5a4.2 4.2 0 0 1 5 0" />
    <Path d="M8 7a7 7 0 0 1 8 0" />
    <Circle cx="12" cy="13.5" r="1.4" fill="#fff" stroke="none" />
  </Svg>
);

const DriverWriteCard = ({ navigation }: Props) => {
  const { supported, reading, writeCard } = useNfc();
  const [cardNumber, setCardNumber] = useState("");
  const [written, setWritten] = useState<string | null>(null);

  const handleWrite = async () => {
    const num = cardNumber.trim();
    if (!/^\d{4,6}$/.test(num)) {
      toast.error("Enter card number", "Type the 4-digit number printed on the card.");
      return;
    }
    const ok = await writeCard(num);
    if (ok) {
      setWritten(num);
      setCardNumber("");
      toast.success("Card written", `Card encoded with ${num}.`);
    } else {
      toast.error("Write failed", "Couldn't write the card. Hold it steady on the back of the phone and try again.");
    }
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
          <Text style={styles.headerTitle}>Write / encode card</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centerContent}>
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={written ? ["#0C9D61", "#2ECC71"] : ["#F4531F", "#FF8A50"]}
            style={styles.nfcIconCircle}
          >
            <NfcCardIcon size={62} />
          </LinearGradient>

          <Text style={styles.holdTitle}>
            {reading ? "Tapping..." : written ? "Card written" : "Enter card number"}
          </Text>
          <Text style={styles.holdSubtitle}>
            {supported
              ? "Type the 4-digit number printed on the card, then tap the card flat on the back of the phone."
              : "NFC not available on this device."}
          </Text>

          {written && (
            <View style={styles.writtenBadge}>
              <Text style={styles.writtenBadgeText}>{written}</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomContainer}>
          <TextInput
            style={styles.manualInput}
            value={cardNumber}
            onChangeText={(t) => {
              setCardNumber(t);
              setWritten(null);
            }}
            placeholder="e.g. 7001"
            placeholderTextColor="#9AA6BC"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity activeOpacity={0.8} onPress={handleWrite} disabled={reading}>
            <View style={[styles.writeButton, reading && { opacity: 0.7 }]}>
              {reading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.writeButtonText}>
                  {written ? "Write another" : "Tap card to write"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#131B2E",
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  nfcIconCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F4531F",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 44,
    elevation: 10,
  },
  holdTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 36,
  },
  holdSubtitle: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#9FB0CC",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  writtenBadge: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: "rgba(12,157,97,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(12,157,97,0.5)",
  },
  writtenBadgeText: {
    color: "#2ECC71",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 4,
  },
  bottomContainer: {
    paddingHorizontal: 26,
    paddingBottom: 36,
    gap: 12,
  },
  manualInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
  },
  writeButton: {
    padding: 16,
    borderRadius: 99,
    backgroundColor: "#F4531F",
    alignItems: "center",
    shadowColor: "#F4531F",
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  writeButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default DriverWriteCard;