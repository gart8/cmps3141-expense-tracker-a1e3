import { createApp } from "https://mavue.mavo.io/mavue.js";
import { deleteTransaction as deleteStoredTransaction, loadTransactions } from "./data-store.js";

createApp({
  template: document.getElementById("app").innerHTML,
  data: {
    transactions: await loadTransactions(),
    searchTerm: "",
    sharingFilter: "all",
    sortOrder: "newest"
  },

  computed: {
    filteredTransactions() {
      const search = this.searchTerm.trim().toLowerCase();
      return [...this.transactions]
        .filter(transaction => {
          const searchable = [transaction.description, transaction.category, transaction.paidBy, transaction.paidTo, ...(transaction.payers || []).map(payer => payer.name)].join(" ").toLowerCase();
          const matchesSearch = !search || searchable.includes(search);
          const status = transaction.type === "settlement"
            ? "settlement"
            : transaction.sharing?.status === "incomplete"
            ? "incomplete"
            : transaction.allocation?.mode === "none" ? "none" : "shared";
          return matchesSearch && (this.sharingFilter === "all" || status === this.sharingFilter);
        })
        .sort((first, second) => {
          const direction = this.sortOrder === "oldest" ? 1 : -1;
          return direction * first.date.localeCompare(second.date);
        });
    }
  },

  methods: {
    transactionTitle(transaction) {
      if (transaction.type === "settlement") return `Payback: ${transaction.paidBy} to ${transaction.paidTo}`;
      return transaction.description || "Unlabeled transaction";
    },

    transactionAmount(transaction) {
      return `${this.transactionCurrency(transaction)} ${this.transactionValue(transaction)}`;
    },

    transactionCurrency(transaction) {
      return transaction.originalCurrency || transaction.currency || "BZD";
    },

    transactionValue(transaction) {
      const amount = transaction.originalAmount ?? transaction.amount ?? 0;
      return Number(amount).toFixed(2);
    },

    payerSummary(transaction) {
      if (transaction.type === "settlement") return `${transaction.paidBy} paid ${transaction.paidTo}`;
      if (Array.isArray(transaction.payers)) {
        return transaction.payers.map(payer => `${payer.name}: ${transaction.originalCurrency || "BZD"} ${Number(payer.amount).toFixed(2)}`).join("; ");
      }
      return `Paid by ${transaction.paidBy || "Unknown"}`;
    },

    payerEntries(transaction) {
      const currency = transaction.originalCurrency || transaction.currency || "BZD";
      if (Array.isArray(transaction.payers)) {
        return transaction.payers.map(payer => ({
          name: payer.name || "Unknown",
          value: Number(payer.amount || 0).toFixed(2),
          currency
        }));
      }
      return [{ name: transaction.paidBy || "Unknown", value: "", currency: "" }];
    },

    sharingSummary(transaction) {
      if (transaction.type === "settlement") return "Payback recorded";
      if (transaction.sharing?.status === "incomplete") return "Sharing details pending";
      if (transaction.allocation?.mode === "none") return "No sharing needed";
      if (transaction.allocation?.mode === "equal") return "Split equally";
      if (transaction.allocation?.mode === "custom") return "Custom shares";
      return "Sharing not added";
    },

    transactionStatusLabel(transaction) {
      if (transaction.type === "settlement") return "Payback";
      if (transaction.sharing?.status === "incomplete") return "Details pending";
      if (transaction.allocation?.mode === "none") return "Personal payment";
      return "Payment";
    },

    transactionStatusClass(transaction) {
      if (transaction.type === "settlement") return "payback";
      if (transaction.sharing?.status === "incomplete") return "pending";
      if (transaction.allocation?.mode === "none") return "personal";
      return "shared";
    },

    editTransaction(transaction) {
      window.location.href = `record-transaction.html?edit=${encodeURIComponent(transaction.id)}`;
    },

    async deleteTransaction(transaction) {
      if (!await window.confirmDeleteTransaction()) return;
      try {
        await deleteStoredTransaction(transaction);
      } catch (error) {
        console.error(error);
        return;
      }
      this.transactions = this.transactions.filter(item => item.id !== transaction.id);
    }
  }
});

if (window.lucide) {
  requestAnimationFrame(() => window.lucide.createIcons());
}
