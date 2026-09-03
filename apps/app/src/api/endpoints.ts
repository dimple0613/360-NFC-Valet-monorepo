export const ApiEndpoints = {
  auth: {
    driverLogin: "/auth/driver-login",
    driverForgotPassword: "/auth/driver/forgot-password",
    driverResetPassword: "/auth/driver/reset-password",
    logout: "/auth/logout",
  },
  driver: {
    dashboard: "/driver/dashboard",
    queue: "/driver/queue",
    shift: "/driver/shift",
    orders: "/driver/orders",
    orderStatus: (id: number) => `/driver/orders/${id}`,
    properties: "/driver/properties",
    history: "/driver/history",
    profile: "/driver/profile",
    scanPlate: "/driver/scan-plate",
    pushToken: "/driver/push-token",
    notifyDelay: "/driver/notify-delay",
  },
} as const;
