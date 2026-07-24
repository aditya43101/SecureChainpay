import Razorpay from 'razorpay';
import crypto from 'crypto';

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface IPaymentGateway {
  createOrder(amount: number, currency: string, receipt?: string): Promise<PaymentOrder>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
}

class RazorpayGateway implements IPaymentGateway {
  private razorpay: Razorpay;
  private secret: string;

  constructor() {
    this.secret = process.env.RAZORPAY_KEY_SECRET || '';
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy',
      key_secret: this.secret,
    });
  }

  async createOrder(amount: number, currency: string = 'USD', receipt?: string): Promise<PaymentOrder> {
    const order = await this.razorpay.orders.create({
      amount: Math.round(amount * 100), // amount in smallest currency unit
      currency,
      receipt: receipt || `receipt_order_${Date.now()}`,
    });

    return {
      id: order.id,
      amount: Number(order.amount) / 100,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const generated_signature = crypto
      .createHmac('sha256', this.secret)
      .update(orderId + "|" + paymentId)
      .digest('hex');

    return generated_signature === signature;
  }
}

class MockGateway implements IPaymentGateway {
  // We use a dummy secret for the mock gateway signature validation
  private secret = 'mock_secret_123';

  async createOrder(amount: number, currency: string = 'USD', receipt?: string): Promise<PaymentOrder> {
    const mockOrderId = `mock_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    return {
      id: mockOrderId,
      amount,
      currency,
      receipt: receipt || `receipt_order_${Date.now()}`,
      status: 'created',
    };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const generated_signature = crypto
      .createHmac('sha256', this.secret)
      .update(orderId + "|" + paymentId)
      .digest('hex');

    return generated_signature === signature;
  }
}

let gatewayInstance: IPaymentGateway;

export function getPaymentGateway(): IPaymentGateway {
  if (!gatewayInstance) {
    const provider = process.env.PAYMENT_GATEWAY_PROVIDER || 'mock';
    if (provider === 'mock') {
      gatewayInstance = new MockGateway();
    } else {
      gatewayInstance = new RazorpayGateway();
    }
  }
  return gatewayInstance;
}
