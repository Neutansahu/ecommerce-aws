// Opens the Razorpay checkout for an order. Resolves 'paid' or 'dismissed'.
export async function payOnline(call, orderId, user) {
  const rp = await call('/payments/create-order', { method: 'POST', body: { order_id: orderId } });
  if (!window.Razorpay) throw new Error('The payment window could not load. Check your internet and try again.');
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: rp.key_id,
      amount: rp.amount,
      currency: rp.currency,
      order_id: rp.razorpay_order_id,
      name: 'ShopNest',
      description: `Order #${orderId}`,
      prefill: { name: user ? user.name : '', email: user ? user.email : '' },
      theme: { color: '#2563eb' },
      handler: async (resp) => {
        try {
          await call('/payments/verify', { method: 'POST', body: resp });
          resolve('paid');
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve('dismissed') },
    });
    checkout.open();
  });
}
