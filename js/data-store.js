const API_URL = "https://infinityconsultingbz.wixsite.com/expenses-tracker/_functions/transactions";

function normalizeTransaction(transaction) {
  return {
    ...transaction,
    id: transaction.id || transaction.transactionId || transaction._id
  };
}

export async function loadTransactions() {
  const response = await fetch(API_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load Wix data (${response.status})`);
  const data = await response.json();
  const transactions = Array.isArray(data) ? data : data?.value;
  return Array.isArray(transactions) ? transactions.map(normalizeTransaction) : [];
}

export async function saveTransaction(transaction) {
  const payload = { ...transaction, transactionId: transaction.transactionId || transaction.id };
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Could not save Wix data (${response.status})`);
  return normalizeTransaction(await response.json());
}

export async function updateTransaction(transaction) {
  const databaseId = transaction._id || transaction.transactionId || transaction.id;
  const transactionId = transaction.transactionId || transaction.id;
  const response = await fetch(`${API_URL}/${encodeURIComponent(databaseId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...transaction, transactionId })
  });
  if (!response.ok) throw new Error(`Could not update Wix data (${response.status})`);
  return normalizeTransaction(await response.json());
}

export async function deleteTransaction(transaction) {
  const databaseId = transaction._id || transaction.transactionId || transaction.id;
  const response = await fetch(`${API_URL}/${encodeURIComponent(databaseId)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error(`Could not delete Wix data (${response.status})`);
}