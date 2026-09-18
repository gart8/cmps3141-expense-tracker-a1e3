import { createApp } from "https://mavue.mavo.io/mavue.js";

const STORAGE_KEY = "expense-tracker-transactions";

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

createApp({
  data: {
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "BZD",
    paidBy: "",
    paidTo: "",
    transactions: loadTransactions(),
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
    recordSettlement() {
      const amount = Number(this.amount);
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

      const settlement = {
        id: `settlement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "settlement",
        date: this.date,
        originalAmount: Math.round(amount * 100) / 100,
        originalCurrency: this.currency,
        exchangeRate: this.currency === "BZD" ? 1 : 1,
        convertedAmount: Math.round(amount * 100) / 100,
        paidBy: this.paidBy,
        paidTo: this.paidTo,
        sharing: { required: false, status: "not-needed" },
        notes: "Settlement"
      };

      this.transactions.unshift(settlement);
      saveTransactions(this.transactions);
      this.amount = "";
      this.paidBy = "";
      this.paidTo = "";
      this.message = "Payback recorded.";
    },

    clearForm() {
      this.date = new Date().toISOString().slice(0, 10);
      this.amount = "";
      this.currency = "BZD";
      this.paidBy = "";
      this.paidTo = "";
      this.message = "";
      this.error = "";
    }
  }
});

if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
