import { createApp } from "https://mavue.mavo.io/mavue.js";
import { deleteTransaction as deleteStoredTransaction, loadTransactions, saveTransaction, updateTransaction } from "./data-store.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const storedTransactions = await loadTransactions();
const editId = new URLSearchParams(window.location.search).get("edit") || "";
const editingTransaction = storedTransactions.find(transaction => transaction.id === editId);
const editingAllocation = editingTransaction?.allocation;

createApp({
  template: document.getElementById("app").innerHTML,
  data: {
    editId: editingTransaction?.id || "",
    description: editingTransaction?.description || "",
    amount: editingTransaction?.originalAmount ?? "",
    currency: editingTransaction?.originalCurrency || "BZD",
    exchangeRate: editingTransaction?.exchangeRate || 1,
    date: editingTransaction?.date || today(),
    currentStep: editingTransaction?.sharing?.required && editingAllocation ? 2 : 1,
    saveIncomplete: false,
    payers: editingTransaction?.payers || [{ name: "", amount: "" }],
    sharingMode: editingTransaction?.sharing?.required ? "shared" : "none",
    allocationMode: editingAllocation?.mode === "custom" ? "custom" : "equal",
    participants: editingAllocation?.participants || [{ name: "", share: "" }],
    category: editingTransaction?.category || "",
    notes: editingTransaction?.notes || "",
    transactions: storedTransactions,
    message: "",
    error: ""
  },

  computed: {
    payerTotal() {
      return this.payers.reduce((sum, payer) => sum + (Number(payer.amount) || 0), 0);
    },

    payerRemaining() {
      return (Number(this.amount) || 0) - this.payerTotal;
    },

    payerProgress() {
      const total = Number(this.amount) || 0;
      return total > 0 ? Math.min(100, Math.max(0, (this.payerTotal / total) * 100)) : 0;
    },

    payerTotalsValid() {
      return Number(this.amount) > 0 && Math.abs(this.payerRemaining) <= 0.01;
    },

    amountError() {
      return this.amount !== "" && (!Number.isFinite(Number(this.amount)) || Number(this.amount) <= 0)
        ? "Enter an amount greater than zero."
        : "";
    },

    currencyError() {
      return this.currency && !/^[A-Z]{3}$/.test(String(this.currency).trim().toUpperCase())
        ? "Choose a valid currency."
        : "";
    },

    dateError() {
      return !this.date ? "Choose the date when the transaction happened." : "";
    },

    exchangeRateError() {
      const rate = Number(this.exchangeRate);
      return this.currency !== "BZD" && (!Number.isFinite(rate) || rate <= 0)
        ? "Enter the exchange rate to BZD."
        : "";
    },

    payerTotalError() {
      return Number(this.amount) > 0 && Math.abs(this.payerRemaining) > 0.01
        ? `Payer amounts must add up to ${String(this.currency).toUpperCase()} ${Number(this.amount).toFixed(2)}.`
        : "";
    },

    convertedAmount() {
      return (Number(this.amount) || 0) * (Number(this.exchangeRate) || 0);
    },

    namedParticipants() {
      return this.participants.filter(participant => String(participant.name || "").trim());
    },

    allocationTotal() {
      if (this.sharingMode === "none") {
        return 0;
      }
      if (this.namedParticipants.length === 0) {
        return 0;
      }
      if (this.allocationMode === "equal") {
        return Number(this.amount) || 0;
      }
      return this.namedParticipants.reduce((sum, participant) => sum + (Number(participant.share) || 0), 0);
    },

    allocationRemaining() {
      return (Number(this.amount) || 0) - this.allocationTotal;
    },

    allocationProgress() {
      const total = Number(this.amount) || 0;
      return total > 0 ? Math.min(100, Math.max(0, (this.allocationTotal / total) * 100)) : 0;
    },

    allocationTotalsValid() {
      return this.sharingMode !== "shared" || (this.namedParticipants.length > 0 && Math.abs(this.allocationRemaining) <= 0.01);
    },

    personSuggestions() {
      const names = this.transactions.flatMap(transaction => {
        const payerNames = Array.isArray(transaction.payers)
          ? transaction.payers.map(payer => payer.name)
          : transaction.paidBy ? [transaction.paidBy] : [];
        const participantNames = transaction.allocation?.participants?.map(participant => participant.name) || [];
        return [...payerNames, ...participantNames];
      });
      return [...new Set(names.filter(Boolean))];
    },

  },

  methods: {
    payerNameError(payer) {
      return this.error && !String(payer.name || "").trim() ? "Enter who paid." : "";
    },

    payerAmountError(payer) {
      const amount = Number(payer.amount);
      return this.error && (!Number.isFinite(amount) || amount <= 0) ? "Enter the amount paid." : "";
    },

    saveSharedForLater() {
      this.saveIncomplete = true;
      this.recordTransaction();
      this.saveIncomplete = false;
    },

    handleShortcut() {
      if (this.currentStep === 1 && this.sharingMode === "shared") {
        this.continueToSharing();
        return;
      }
      this.recordTransaction();
    },

    continueToSharing() {
      const amount = Number(this.amount);
      const currency = String(this.currency || "").trim().toUpperCase();
      const exchangeRate = currency === "BZD" ? 1 : Number(this.exchangeRate);
      const payers = this.payers.map(payer => ({
        name: String(payer.name || "").trim(),
        amount: Number(payer.amount)
      }));

      this.error = "";
      if (!Number.isFinite(amount) || amount <= 0) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (!/^([A-Z]{3})$/.test(currency)) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (currency !== "BZD" && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (!this.date) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (payers.some(payer => !payer.name || !Number.isFinite(payer.amount) || payer.amount <= 0)) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (Math.abs(payers.reduce((sum, payer) => sum + payer.amount, 0) - amount) > 0.01) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      this.currentStep = 2;
    },

    backToPayment() {
      this.currentStep = 1;
      this.error = "";
    },

    enableSharing() {
      this.sharingMode = "shared";
      this.allocationMode = "equal";
    },

    disableSharing() {
      this.sharingMode = "none";
    },

    syncSinglePayerAmount() {
      if (this.payers.length === 1) {
        this.payers[0].amount = this.amount;
      }
    },

    addPayer() {
      this.payers.push({ name: "", amount: "" });
    },

    removePayer(index) {
      if (this.payers.length > 1) {
        this.payers.splice(index, 1);
      }
    },

    addParticipant() {
      this.participants.push({ name: "", share: "" });
    },

    removeParticipant(index) {
      if (this.participants.length > 1) {
        this.participants.splice(index, 1);
      }
    },

    async recordTransaction() {
      const amount = Number(this.amount);
      const currency = String(this.currency || "").trim().toUpperCase();
      const exchangeRate = currency === "BZD" ? 1 : Number(this.exchangeRate);

      this.error = "";
      this.message = "";

      if (!Number.isFinite(amount) || amount <= 0) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      if (!/^([A-Z]{3})$/.test(currency)) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      if (!this.date) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      if (currency !== "BZD" && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      const payers = this.payers.map(payer => ({
        name: String(payer.name || "").trim(),
        amount: Math.round(Number(payer.amount) * 100) / 100
      }));
      if (payers.some(payer => !payer.name)) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (payers.some(payer => !Number.isFinite(payer.amount) || payer.amount <= 0)) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      const paidTotal = payers.reduce((sum, payer) => sum + payer.amount, 0);
      if (Math.abs(paidTotal - amount) > 0.01) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      const participants = this.participants
        .map(participant => ({
          name: String(participant.name || "").trim(),
          share: this.allocationMode === "custom"
            ? Math.round(Number(participant.share) * 100) / 100
            : null
        }))
        .filter(participant => participant.name);

      if (this.sharingMode === "shared" && participants.some(participant => this.allocationMode === "custom" && (!Number.isFinite(participant.share) || participant.share < 0))) {
        this.error = "Please check the highlighted fields.";
        return;
      }
      if (this.sharingMode === "shared" && this.allocationMode === "custom" && participants.length > 0) {
        const allocatedTotal = participants.reduce((sum, participant) => sum + participant.share, 0);
        if (Math.abs(allocatedTotal - amount) > 0.01) {
          this.error = "Please check the highlighted fields.";
          return;
        }
      }
      if (this.sharingMode === "shared" && !this.saveIncomplete && participants.length === 0) {
        this.error = "Please check the highlighted fields.";
        return;
      }

      const allocation = this.sharingMode === "none"
        ? { mode: "none" }
        : this.saveIncomplete
          ? null
        : participants.length ? {
          mode: this.allocationMode,
          participants
        } : null;

      const transaction = {
        id: this.editId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: String(this.description || "").trim(),
        originalAmount: Math.round(amount * 100) / 100,
        originalCurrency: currency,
        exchangeRate,
        convertedAmount: Math.round(amount * exchangeRate * 100) / 100,
        date: this.date,
        payers,
        sharing: this.sharingMode === "shared"
          ? { required: true, status: this.saveIncomplete ? "incomplete" : "complete" }
          : { required: false, status: "not-needed" },
        allocation,
        category: String(this.category || "").trim(),
        notes: String(this.notes || "").trim()
      };

      const wasEditing = Boolean(this.editId);
      try {
        if (wasEditing) {
          await updateTransaction(transaction);
        } else {
          await saveTransaction(transaction);
        }
      } catch (error) {
        this.error = "Could not save this payment. Check the Wix connection and try again.";
        console.error(error);
        return;
      }

      const existingIndex = this.transactions.findIndex(item => item.id === transaction.id);
      if (existingIndex >= 0) {
        this.transactions.splice(existingIndex, 1, transaction);
      } else {
        this.transactions.unshift(transaction);
      }
      this.editId = "";
      this.description = "";
      this.amount = "";
      this.currency = "BZD";
      this.exchangeRate = 1;
      this.payers = [{ name: "", amount: "" }];
      this.sharingMode = "none";
      this.allocationMode = "equal";
      this.participants = [{ name: "", share: "" }];
      this.currentStep = 1;
      this.saveIncomplete = false;
      this.category = "";
      this.notes = "";
      if (wasEditing) {
        this.message = "Transaction updated. Form is ready for another entry.";
      } else if (this.saveIncomplete) {
        this.message = "Payment saved. Sharing can be completed later. Form is ready for another entry.";
      } else {
        this.message = "Transaction saved. Form is ready for another entry.";
      }
    },

    clearForm() {
      this.description = "";
      this.amount = "";
      this.currency = "BZD";
      this.exchangeRate = 1;
      this.date = today();
      this.payers = [{ name: "", amount: "" }];
      this.sharingMode = "none";
      this.allocationMode = "equal";
      this.participants = [{ name: "", share: "" }];
      this.currentStep = 1;
      this.saveIncomplete = false;
      this.category = "";
      this.notes = "";
      this.message = "";
      this.error = "";
    },

    async deleteTransaction(transaction) {
      try {
        await deleteStoredTransaction(transaction);
      } catch (error) {
        this.error = "Could not remove this payment. Check the Wix connection and try again.";
        console.error(error);
        return;
      }
      this.transactions = this.transactions.filter(item => item.id !== transaction.id);
      this.message = "Transaction removed.";
      this.error = "";
    },

    formatAmount(transaction) {
      const currency = transaction.originalCurrency || transaction.currency;
      const amount = transaction.originalAmount ?? transaction.amount;
      return `${currency} ${Number(amount).toFixed(2)}`;
    },

    payerSummary(transaction) {
      const currency = transaction.originalCurrency || transaction.currency;
      if (Array.isArray(transaction.payers)) {
        return transaction.payers.map(payer => `${payer.name}: ${currency} ${Number(payer.amount).toFixed(2)}`).join("; ");
      }
      return `Paid by ${transaction.paidBy || "Unknown"}`;
    },

    sharingSummary(transaction) {
      if (transaction.sharing?.status === "incomplete") return "Sharing details pending";
      if (transaction.allocation?.mode === "none") return "No sharing needed";
      if (transaction.allocation?.mode === "equal") return "Split equally";
      if (transaction.allocation?.mode === "custom") return "Custom shares";
      return "Sharing not added";
    },

    convertedSummary(transaction) {
      if (transaction.convertedAmount === undefined || (transaction.originalCurrency || transaction.currency) === "BZD") {
        return "";
      }
      return `BZD ${Number(transaction.convertedAmount).toFixed(2)}`;
    }
  }
});

if (window.lucide) {
  requestAnimationFrame(() => window.lucide.createIcons());
}
