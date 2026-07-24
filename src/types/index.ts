// ============================================================
// SecureChain Pay — Core Type Definitions (Production v2)
// Complete domain models for the entire platform
// ============================================================

// ---- User & Auth ----
export interface User {
  id: string;
  phone: string;
  countryCode: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  walletAddress: string;
  kycStatus: 'not_started' | 'pending' | 'under_review' | 'verified' | 'rejected';
  role: 'user' | 'merchant' | 'admin';
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  isActive: boolean;
  securityScore: number;
  trustScore: number;
  twoFactorEnabled: boolean;
  devices: Device[];
}

export interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tablet';
  os: string;
  browser: string;
  ip: string;
  fingerprint: string;
  lastActive: string;
  isCurrent: boolean;
  isTrusted: boolean;
  location?: string;
}

export interface Session {
  id: string;
  userId: string;
  device: Device;
  tokenHash: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

export interface LoginHistory {
  id: string;
  userId: string;
  device: Device;
  timestamp: string;
  status: 'success' | 'failed' | 'blocked';
  ip: string;
  location?: string;
  failReason?: string;
}

// ---- KYC ----
export type KYCDocumentType = 'aadhaar' | 'pan' | 'selfie';

export interface KYCDocument {
  id: string;
  userId: string;
  type: KYCDocumentType;
  documentUrl: string;
  status: 'uploaded' | 'under_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// ---- Wallet ----
export interface Wallet {
  address: string;
  balance: number;
  currency: string;
  encryptedPin: string;
  isFrozen: boolean;
  createdAt: string;
  dailyLimit: number;
  monthlyLimit: number;
  todaySpent: number;
  monthSpent: number;
  recoveryPhraseHash: string;
  backupEnabled: boolean;
  autoTopUp: boolean;
  autoTopUpAmount: number;
  autoTopUpThreshold: number;
  linkedAccounts: LinkedAccount[];
}

// ---- Transaction (Extended Statuses) ----
export type TransactionType =
  | 'transfer'
  | 'receive'
  | 'add_money'
  | 'withdraw'
  | 'payment'
  | 'refund'
  | 'split_bill'
  | 'group_payment'
  | 'merchant_payment'
  | 'scheduled'
  | 'recurring';

export type TransactionStatus =
  | 'initiated'
  | 'processing'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'reversed'
  | 'refunded';

export interface Transaction {
  id: string;
  blockchainHash: string;
  sender: string;
  senderName: string;
  receiver: string;
  receiverName: string;
  amount: number;
  fee: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  date: string;
  time: string;
  timestamp: number;
  note?: string;
  category?: string;
  digitalSignature: string;
  blockNumber: number;
  confirmations: number;
  merkleProof?: string[];
  riskScore: number;
  gasUsed?: string;
  gasPrice?: string;
  contractAddress?: string;
  chainId: number;
  network: string;
  transactionSize?: number;
  validatorAddress?: string;
  metadata?: Record<string, unknown>;
}

// ---- Blockchain ----
export interface Block {
  index: number;
  timestamp: number;
  previousHash: string;
  hash: string;
  nonce: number;
  merkleRoot: string;
  transactions: Transaction[];
  difficulty: number;
  miner: string;
  size: number;
  gasUsed: string;
  gasLimit: string;
  validationStatus: 'valid' | 'invalid' | 'pending';
  chainId: number;
  network: string;
}

export interface BlockchainStatus {
  totalBlocks: number;
  totalTransactions: number;
  lastBlockTime: string;
  chainValid: boolean;
  difficulty: number;
  hashRate: string;
  pendingTransactions: number;
  networkStatus: 'healthy' | 'degraded' | 'down';
  tps: number;
  avgConfirmationTime: number;
  nodeCount: number;
  chainId: number;
  network: string;
  contractAddress: string;
}

// ---- AI Fraud Detection ----
export interface FraudAnalysis {
  transactionId: string;
  riskScore: number;
  trustScore: number;
  flags: FraudFlag[];
  recommendation: 'approve' | 'review' | 'block';
  requiresOTP: boolean;
  analysisTimestamp: string;
  modelVersion: string;
}

export interface FraudFlag {
  type: 'large_amount' | 'velocity' | 'location' | 'device' | 'duplicate' | 'pattern' | 'time' | 'new_recipient';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;
  details?: Record<string, unknown>;
}

// ---- Notification ----
export type NotificationType =
  | 'payment_success'
  | 'payment_failed'
  | 'money_received'
  | 'money_sent'
  | 'security_alert'
  | 'login_alert'
  | 'suspicious_activity'
  | 'kyc_update'
  | 'system'
  | 'request_money'
  | 'settlement';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  icon?: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  data?: Record<string, unknown>;
}

// ---- Chat (E2E Encrypted) ----
export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  walletAddress: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline: boolean;
  isFavourite: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  encryptedContent: string;
  decryptedContent?: string;
  type: 'text' | 'payment' | 'request' | 'system';
  timestamp: string;
  read: boolean;
  payment?: {
    amount: number;
    status: TransactionStatus;
    transactionId?: string;
  };
}

// ---- Payment Request ----
export interface PaymentRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar?: string;
  requesteeId: string;
  requesteeName: string;
  amount: number;
  note?: string;
  status: 'pending' | 'paid' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// ---- Merchant (Enhanced) ----
export interface Merchant {
  id: string;
  userId: string;
  businessName: string;
  category: string;
  gstNumber?: string;
  status: 'active' | 'suspended' | 'pending' | 'verified';
  verifiedAt?: string;
  qrCode: string;
  totalSales: number;
  totalTransactions: number;
  rating: number;
  createdAt: string;
}

export interface Settlement {
  id: string;
  merchantId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'settled' | 'failed';
  utrNumber?: string;
  settledAt?: string;
  createdAt: string;
  transactionIds: string[];
}

export interface Invoice {
  id: string;
  merchantId: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  gst: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  createdAt: string;
  paidAt?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  gstRate: number;
}

// ---- Banking ----
export interface LinkedAccount {
  id: string;
  userId: string;
  type: 'bank' | 'debit_card' | 'credit_card';
  name: string;
  lastFour: string;
  bank: string;
  isDefault: boolean;
  razorpayToken?: string;
  addedAt: string;
}

// ---- Scheduled Payments ----
export interface ScheduledPayment {
  id: string;
  userId: string;
  receiverAddress: string;
  receiverName: string;
  amount: number;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  lastRun?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  note?: string;
  createdAt: string;
}

// ---- Spending & Savings Goals ----
export interface SpendingGoal {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  currentSpent: number;
  month: string;
  color: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  icon: string;
  color: string;
  createdAt: string;
}

// ---- Favourite Contacts ----
export interface FavouriteContact {
  id: string;
  userId: string;
  contactUserId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  contactWalletAddress: string;
  nickname?: string;
  addedAt: string;
}

// ---- Analytics ----
export interface SpendingData {
  date: string;
  amount: number;
  category?: string;
}

export interface AnalyticsOverview {
  todaySpending: number;
  weeklySpending: number;
  monthlySpending: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  walletGrowth: number;
  walletGrowthPercent: number;
  categoryBreakdown: CategorySpending[];
  dailyData: SpendingData[];
  weeklyData: SpendingData[];
  monthlyData: SpendingData[];
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

// ---- Admin (Enhanced) ----
export interface AdminStats {
  // User metrics
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  pendingKyc: number;
  newUsersToday: number;

  // Wallet metrics
  totalWallets: number;
  totalBalance: number;
  frozenWallets: number;

  // Transaction metrics
  totalTransactions: number;
  dailyTransactions: number;
  weeklyTransactions: number;
  monthlyTransactions: number;
  totalVolume: number;
  dailyVolume: number;
  tps: number;
  avgConfirmationTime: number;
  avgTransactionValue: number;
  highestTransactionToday: number;
  failedTransactionRatio: number;

  // Activity metrics
  mostActiveUser: { id: string; name: string; txCount: number };
  mostActiveMerchant: { id: string; name: string; txCount: number };

  // System metrics
  systemUptime: number;
  serverStatus: 'online' | 'degraded' | 'offline';
  apiStatus: 'online' | 'degraded' | 'offline';
  paymentGatewayStatus: 'online' | 'degraded' | 'offline';
  blockchainHealth: 'healthy' | 'degraded' | 'down';
  blockchainNodeStatus: 'synced' | 'syncing' | 'disconnected';

  // Revenue
  totalRevenue: number;
  dailyRevenue: number;
  monthlyRevenue: number;

  // Fraud
  fraudAlerts: number;
  flaggedAccounts: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: 'user' | 'transaction' | 'wallet' | 'merchant' | 'system' | 'kyc';
  targetId: string;
  details: string;
  ip: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

// ---- Settings ----
export interface UserSettings {
  darkMode: boolean;
  notifications: {
    payments: boolean;
    security: boolean;
    marketing: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  privacy: {
    showBalance: boolean;
    showActivity: boolean;
    showProfile: boolean;
  };
  autoLogout: boolean;
  sessionTimeout: number;
  language: string;
  currency: string;
}

// ---- Report ----
export interface Report {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'annual';
  generatedAt: string;
  generatedBy: string;
  period: { start: string; end: string };
  summary: {
    totalTransactions: number;
    totalVolume: number;
    totalFees: number;
    newUsers: number;
    activeUsers: number;
    failedTransactions: number;
    fraudAlerts: number;
  };
  downloadUrl?: string;
  format: 'pdf' | 'csv';
}

// ---- QR Code ----
export interface QRData {
  type: 'static' | 'dynamic' | 'merchant';
  walletAddress: string;
  amount?: number;
  note?: string;
  merchantId?: string;
  expiresAt?: string;
  name?: string;
}

// ---- API Response Wrappers ----
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

// ---- Razorpay ----
export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
}

export interface RazorpayPaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
