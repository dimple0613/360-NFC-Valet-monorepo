import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

export const toast = {
  show(type: ToastType, title: string, message?: string) {
    Toast.show({
      type,
      text1: title,
      text2: message,
      props: { toastType: type },
      topOffset: 60,
      visibilityTime: 3000,
    });
  },
  success(title: string, message?: string) {
    this.show("success", title, message);
  },
  error(title: string, message?: string) {
    this.show("error", title, message);
  },
  info(title: string, message?: string) {
    this.show("info", title, message);
  },
};
