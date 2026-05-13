import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Package, Shield, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { auctionApi } from '../api/auction';
import type { AuctionDetail } from '../api/types';
import { useToast } from '../components/common/Toast';
import { formatPrice } from '../utils/format';
import { formatCategoryDisplay } from '../utils/category';
import { ErrorPage } from './ErrorPage';
import { getRenderableImageUrl } from '../utils/image';

export function CheckoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [item, setItem] = useState<AuctionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await auctionApi.getAuctionDetail(id);
        if (res.success) {
          setItem(res.data);
        }
      } catch {
        setError('Failed to load auction details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handlePayment = async () => {
    if (!item) return;
    
    setIsProcessing(true);
    try {
      const res = await auctionApi.processPayment(item.id);
      if (res.success) {
        showToast('Payment successful! Your item will be shipped soon.', 'success');
        navigate('/my-page?tab=auctions');
      }
    } catch (err) {
      const error = err as { message?: string };
      showToast(error.message || 'Payment failed. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 text-blue-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="text-gray-400">Loading checkout details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !item) {
    return (
      <ErrorPage 
        code="404" 
        title="Auction Not Found" 
        message="결제 정보를 불러올 수 없습니다." 
      />
    );
  }

  const serviceFee = Math.floor(item.currentPrice * 0.05);
  const shippingFee = 0; // Free shipping
  const totalAmount = item.currentPrice + serviceFee + shippingFee;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-2xl p-6 shadow-xl sticky top-24">
              <h2 className="text-white font-bold text-xl mb-4">Order Summary</h2>
              <div className="mb-6">
                <div className="aspect-video rounded-xl overflow-hidden mb-4 border border-[#1e3a5f]">
                  <img src={getRenderableImageUrl(item.mainPictureUrl)} className="w-full h-full object-cover" alt="" />
                </div>
                <h3 className="text-white font-semibold leading-tight">{item.title}</h3>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{formatCategoryDisplay(item.category)}</p>
              </div>

              <div className="border-t border-[#1e3a5f] pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Winning Bid</span>
                  <span className="text-white font-medium">₩{formatPrice(item.currentPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Shipping</span>
                  <span className="text-white font-medium">₩{formatPrice(shippingFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Service Fee (5%)</span>
                  <span className="text-white font-medium">₩{formatPrice(serviceFee)}</span>
                </div>
                <div className="border-t border-[#1e3a5f] pt-3 flex justify-between items-center">
                  <span className="text-white font-bold text-lg">Total</span>
                  <span className="text-blue-400 font-black text-xl">₩{formatPrice(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Payment Method</h2>
                  <p className="text-sm text-gray-400">Choose how you want to pay</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="border-2 border-blue-500 bg-blue-500/5 rounded-xl p-5 flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full border-4 border-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <span className="block text-white font-bold">Credit/Debit Card</span>
                    <span className="text-xs text-gray-400">Visa, Mastercard, etc.</span>
                  </div>
                </div>
                <div className="border border-[#1e3a5f] rounded-xl p-5 flex items-start gap-4 opacity-50 grayscale">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-600 mt-1 flex-shrink-0" />
                  <div>
                    <span className="block text-white font-bold">Bank Transfer</span>
                    <span className="text-xs text-gray-400">Available for verified users</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8 p-6 bg-[#0a1628] rounded-xl border border-[#1e3a5f]">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span>Ships within 24 hours of payment verification</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Originality Guaranteed & Verified Condition</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Secure payment protection by TrustPay</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-xl font-bold text-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Complete Payment</span>
                )}
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 uppercase tracking-widest">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Non-refundable after 7 days of delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
