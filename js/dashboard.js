import { createApp } from "https://mavue.mavo.io/mavue.js";
import { deleteTransaction as deleteStoredTransaction, loadTransactions } from "./data-store.js";

function transactionAmount(transaction) {
  return Number(transaction.convertedAmount ?? transaction.amount) || 0;
}

function isSettlement(transaction) {
  return transaction.type === "settlement";
}

function transactionCurrency(transaction) {
  return transaction.originalCurrency || transaction.currency || "BZD";
}

function transactionOriginalAmount(transaction) {
  return Number(transaction.originalAmount ?? transaction.amount) || 0;
}

function transactionDateLabel(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function transactionDetail(transaction) {
  if (isSettlement(transaction)) {
    return `${transaction.paidBy || "Unknown"} paid back ${transaction.paidTo || "Unknown"}`;
  }
  if (!Array.isArray(transaction.payers)) {
    return `Paid by ${transaction.paidBy || "Unknown"}`;
  }
  const payers = transaction.payers.map(payer => payer.name).filter(Boolean).join(", ");
  if (transaction.allocation?.mode === "none") {
    return `Paid by ${payers || "Unknown"} · Personal expense`;
  }
  if (transaction.sharing?.status === "incomplete" || (!transaction.allocation && transaction.sharing?.required)) {
    return `Paid by ${payers || "Unknown"} · Shared payment — details needed`;
  }
  return `Paid by ${payers || "Unknown"} · Shared payment`;
}

createApp({
  template: document.getElementById("app").innerHTML,
  data: {
    selectedMonth: "All time",
    transactions: await loadTransactions()
  },

  computed: {
    months() {
      const monthNames = [...new Set(this.transactions.map(transaction => transaction.date.slice(0, 7)))];
      return ["All time", ...monthNames.sort().reverse().map(month => {
        const date = new Date(`${month}-01T00:00:00`);
        return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
      })];
    },

    selectedMonthTransactions() {
      if (this.selectedMonth === "All time") return this.transactions;
      return this.transactions.filter(transaction => {
        const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${transaction.date}T00:00:00`));
        return label === this.selectedMonth;
      });
    },

    expenseTransactions() {
      return this.selectedMonthTransactions.filter(transaction => !isSettlement(transaction));
    },

    settlementTransactions() {
      return this.selectedMonthTransactions.filter(isSettlement);
    },

    transactionCount() {
      return this.expenseTransactions.length;
    },

    settlementCount() {
      return this.settlementTransactions.length;
    },

    sharedTransactionCount() {
      return this.expenseTransactions.filter(transaction => transaction.sharing?.required).length;
    },

    pendingSharingCount() {
      return this.expenseTransactions.filter(transaction => transaction.sharing?.status === "incomplete").length;
    },

    personalTransactionCount() {
      return this.expenseTransactions.filter(transaction => transaction.allocation?.mode === "none").length;
    },

    totalBzd() {
      return this.expenseTransactions.reduce((total, transaction) => total + transactionAmount(transaction), 0);
    },

    recentTransactions() {
      return [...this.selectedMonthTransactions]
        .sort((first, second) => second.date.localeCompare(first.date))
        .slice(0, 5)
        .map(transaction => ({
          id: transaction.id,
          title: isSettlement(transaction)
            ? `Payback: ${transaction.paidBy || "Unknown"} to ${transaction.paidTo || "Unknown"}`
            : transaction.description || `${transactionCurrency(transaction)} ${transactionOriginalAmount(transaction).toFixed(2)} transaction`,
          detail: transactionDetail(transaction),
          date: transactionDateLabel(transaction.date),
          amountValue: transactionOriginalAmount(transaction).toFixed(2),
          currency: transactionCurrency(transaction),
          source: transaction
        }));
    },

    balanceRows() {
      const positions = new Map();
      const addPosition = (name, amount) => {
        const cleanName = String(name || "").trim();
        if (cleanName) positions.set(cleanName, (positions.get(cleanName) || 0) + amount);
      };

      this.expenseTransactions.forEach(transaction => {
        const allocation = transaction.allocation;
        if (!allocation?.participants?.length || allocation.mode === "none") return;

        const rate = Number(transaction.exchangeRate) || 1;
        const payers = Array.isArray(transaction.payers)
          ? transaction.payers
          : [{ name: transaction.paidBy, amount: transactionOriginalAmount(transaction) }];
        payers.forEach(payer => addPosition(payer.name, (Number(payer.amount) || 0) * rate));

        const amount = transactionOriginalAmount(transaction);
        const participantCount = allocation.participants.length;
        allocation.participants.forEach(participant => {
          const share = allocation.mode === "custom"
            ? Number(participant.share) || 0
            : amount / participantCount;
          addPosition(participant.name, -(share * rate));
        });
      });

      this.settlementTransactions.forEach(settlement => {
        const amount = transactionAmount(settlement);
        addPosition(settlement.paidBy, amount);
        addPosition(settlement.paidTo, -amount);
      });

      return [...positions.entries()]
        .filter(([, amount]) => Math.abs(amount) > 0.01)
        .sort((first, second) => second[1] - first[1])
        .map(([name, amount]) => ({
          name,
          amountValue: Math.abs(amount).toFixed(2),
          currency: "BZD",
          label: amount > 0 ? "is owed" : "owes"
        }));
    },

    transactionsWithoutAllocation() {
      return this.selectedMonthTransactions.filter(transaction =>
        transaction.sharing?.status === "incomplete" || (!transaction.allocation && transaction.sharing?.required)
      ).length;
    },

    settlementSuggestions() {
      const creditors = this.balanceRows.filter(balance => balance.label === "is owed").map(balance => ({ name: balance.name, amount: Number(balance.amount.replace("BZD ", "")) }));
      const debtors = this.balanceRows.filter(balance => balance.label === "owes").map(balance => ({ name: balance.name, amount: Number(balance.amount.replace("BZD ", "")) }));
      const suggestions = [];
      let creditorIndex = 0;
      let debtorIndex = 0;
      while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const amount = Math.min(creditors[creditorIndex].amount, debtors[debtorIndex].amount);
        if (amount > 0.01) suggestions.push({ from: debtors[debtorIndex].name, to: creditors[creditorIndex].name, amount: `BZD ${amount.toFixed(2)}` });
        creditors[creditorIndex].amount -= amount;
        debtors[debtorIndex].amount -= amount;
        if (creditors[creditorIndex].amount <= 0.01) creditorIndex++;
        if (debtors[debtorIndex].amount <= 0.01) debtorIndex++;
      }
      return suggestions;
    }
  },

  methods: {
    formatBzd(amount) {
      return `BZD ${Number(amount).toFixed(2)}`;
    },

    editTransaction(transaction) {
      window.location.href = `record-transaction.html?edit=${encodeURIComponent(transaction.id)}`;
    },

    async deleteTransaction(transaction) {
      if (!await window.confirmDeleteTransaction()) return;
      try {
        await deleteStoredTransaction(transaction.source);
        this.transactions = this.transactions.filter(item => item.id !== transaction.id);
      } catch (error) {
        console.error(error);
      }
    }
  }
});

if (window.lucide) {
  requestAnimationFrame(() => window.lucide.createIcons());
}
