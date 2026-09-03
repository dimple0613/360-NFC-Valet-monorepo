// No notification framework exists yet — it's explicitly deferred in
// ROADMAP.md ("Deferred to later phases"). This is a documented stand-in so
// local-provider.ts has somewhere to send verification/reset emails without
// waiting on that framework; swap the implementation once it lands, call
// sites won't need to change.

export interface EmailSender {
  send(params: { to: string; subject: string; body: string }): Promise<void>;
}

export const consoleEmailSender: EmailSender = {
  async send(params) {
    console.log(`[email:placeholder] To: ${params.to}\nSubject: ${params.subject}\n\n${params.body}`);
  },
};
