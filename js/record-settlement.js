import { createApp } from "https://mavue.mavo.io/mavue.js";
import { loadTransactions, saveTransaction } from "./data-store.js";

createApp({
  template: document.getElementById("app").innerHTML,
  data: {
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "BZD",
    exchangeRate: 1,
    paidBy: "",
    paidTo: "",
    transactions: await loadTransactions(),
    message: "",
    error: ""
  },

  computed: {
    people() {
      const names = this.transactions.flatMap(transaction => [
        ...(transaction.payers || []).map(payer => payer.name),
        ...(transaction.allocation?.participants || []).map(participant => participant.name),
        transaction.paidBy,
        transaction.paidTo
      ]);
      return [...new Set(names.filter(Boolean))];
    }
  },

  methods: {
    async recordSettlement() {
      const amount = Number(this.amount);
      const exchangeRate = this.currency === "BZD" ? 1 : Number(this.exchangeRate);
      this.error = "";
      this.message = "";

      if (!Number.isFinite(amount) || amount <= 0 || !this.date || !this.paidBy || !this.paidTo) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (this.paidBy === this.paidTo) {
        this.error = "Choose two different people or accounts.";
        return;
      }
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        this.error = "Enter a valid exchange rate to BZD.";
        return;
      }

      const settlement = {
        id: `settlement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "settlement",
        date: this.date,
        originalAmount: Math.round(amount * 100) / 100,
        originalCurrency: this.currency,
        exchangeRate,
        convertedAmount: Math.round(amount * exchangeRate * 100) / 100,
        paidBy: this.paidBy,
        paidTo: this.paidTo,
        sharing: { required: false, status: "not-needed" },
        notes: "Settlement"
      };

      try {
        await saveTransaction(settlement);
      } catch (error) {
        this.error = "Could not save this payback. Check the Wix connection and try again.";
        console.error(error);
        return;
      }
      this.transactions.unshift(settlement);
      this.amount = "";
      this.exchangeRate = 1;
      this.paidBy = "";
      this.paidTo = "";
      this.message = "Payback recorded.";
    },

    clearForm() {
      this.date = new Date().toISOString().slice(0, 10);
      this.amount = "";
      this.currency = "BZD";
      this.exchangeRate = 1;
      this.paidBy = "";
      this.paidTo = "";
      this.message = "";
      this.error = "";
    }
  }
});

if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
