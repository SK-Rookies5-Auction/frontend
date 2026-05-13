import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Package, User, MessageCircle, CheckCircle, Shield, Loader2, Heart, CornerDownRight } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { auctionApi } from '../api/auction';
import type { AuctionDetail, Bid, Comment } from '../api/types';
import { useToast } from '../components/common/Toast';
import { formatPrice, sanitizeNumeric, formatDate, parseDate, formatTime } from '../utils/format';
import { formatCategoryDisplay } from '../utils/category';
import { ErrorPage } from './ErrorPage';
import { getRenderableImageUrl } from '../utils/image';
import { useAuthStore } from '../store/useAuthStore';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, isLoggedIn } = useAuthStore();
  
  const [item, setItem] = useState<AuctionDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [bidAmount, setBidAmount] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  // 답변 관련 상태
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const isSeller = user && item && user.id === item.sellerId;
  const isEnded = item ? new Date(parseDate(item.endTime)).getTime() <= new Date().getTime() : false;
  const isFinished = item?.status === 'FINISHED';

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [detailRes, commentsRes] = await Promise.all([
          auctionApi.getAuctionDetail(id),
          auctionApi.getComments(id)
        ]);

        if (detailRes.success) setItem(detailRes.data);
        if (commentsRes.success) setComments(commentsRes.data);
      } catch {
        setError('Failed to load auction details');
        showToast('Failed to load auction details', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, showToast]);

  const handlePlaceBid = async () => {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error');
      navigate('/login', { state: { from: `/auctions/${id}` } });
      return;
    }

    const amount = parseInt(bidAmount.replace(/,/g, ''));
    if (!item || !amount || amount <= item.currentPrice) {
      showToast('현재 입찰가보다 높은 금액을 입력해야 합니다.', 'error');
      return;
    }

    if (item.status !== 'LIVE' || isEnded) {
      showToast('이미 종료된 경매입니다.', 'error');
      return;
    }

    setIsBidding(true);
    try {
      const res = await auctionApi.placeBid(item.id.toString(), amount);
      if (res.success) {
        const { currentPrice } = res.data;
        
        const newBid: Bid = {
          bidderNickname: 'You',
          price: currentPrice,
          bidTime: new Date().toISOString()
        };

        setItem(prev => prev ? {
          ...prev,
          currentPrice: currentPrice,
          bidCount: (prev.bidCount ?? 0) + 1,
          biddingHistory: [newBid, ...(prev.biddingHistory ?? [])]
        } : null);

        setBidAmount('');
        setFlash(true);
        showToast('입찰이 성공적으로 완료되었습니다!', 'success');
        setTimeout(() => setFlash(false), 500);
      }
    } catch (err) {
      const error = err as { message?: string };
      showToast(error.message || '입찰에 실패했습니다.', 'error');
    } finally {
      setIsBidding(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newQuestion.trim()) return;

    if (isSeller) {
      showToast('본인 경매 상품에는 질문을 남길 수 없습니다.', 'error');
      return;
    }

    setIsSubmittingQuestion(true);
    try {
      const res = await auctionApi.postComment(id, newQuestion);
      if (res.success) {
        const newComment: Comment = {
          id: res.data.id,
          userId: user?.id || 999,
          nickname: user?.nickname || 'You',
          content: newQuestion,
          createdAt: new Date().toISOString(),
          children: []
        };
        setComments(prev => [newComment, ...prev]);
        setNewQuestion('');
        showToast('Question submitted!', 'success');
      }
    } catch {
      showToast('Failed to submit question', 'error');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleSubmitReply = async (commentId: number) => {
    if (!id || !replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
      const res = await auctionApi.postAnswer(id, commentId, replyContent);
      if (res.success) {
        const newReply: Comment = {
          id: res.data.id,
          userId: user?.id || 999,
          nickname: user?.nickname || 'Seller',
          content: replyContent,
          createdAt: new Date().toISOString()
        };

        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, children: [...(c.children || []), newReply] } 
            : c
        ));

        setReplyToId(null);
        setReplyContent('');
        showToast('Reply submitted!', 'success');
      }
    } catch {
      showToast('Failed to submit reply', 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleToggleLike = async () => {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error');
      navigate('/login', { state: { from: `/product/${id}` } });
      return;
    }
    
    if (!item) return;
    try {
      const res = await auctionApi.toggleLike(item.id);
      if (res.success) {
        setItem(prev => prev ? { ...prev, isLiked: res.data.isLiked, likeCount: res.data.likeCount } : null);
        showToast(res.data.isLiked ? 'Added to watchlist' : 'Removed from watchlist', 'success');
      }
    } catch {
      showToast('Failed to update watchlist', 'error');
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 text-blue-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="text-gray-400">Loading auction details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !item) {
    return (
      <ErrorPage 
        code="404" 
        title="Auction Not Found" 
        message="요청하신 경매 상품을 찾을 수 없거나 이미 종료되었습니다." 
      />
    );
  }

  const pictures = Array.isArray(item.pictures) ? item.pictures : [];
  const biddingHistory = Array.isArray(item.biddingHistory) ? item.biddingHistory : [];
  const selectedPicture = pictures[selectedImage];
  const sellerJoinedDate = item.sellerJoinedAt
    ? formatDate(item.sellerJoinedAt)
    : '-';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Auctions</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Left: Images & Seller Info */}
          <div>
            <div className="aspect-square rounded-lg overflow-hidden bg-[#0d1b2e] border border-[#1e3a5f] mb-4">
              <img
                src={getRenderableImageUrl(selectedPicture?.url, item.mainPictureUrl)}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {pictures.map((pic, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === idx ? 'border-blue-500' : 'border-[#1e3a5f]'
                  }`}
                >
                  <img src={getRenderableImageUrl(pic.url, item.mainPictureUrl)} alt={`${item.title} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Seller Info */}
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold">{item.sellerNickname}</span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-xs text-gray-400">
                    Member since {sellerJoinedDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Bidding Panel */}
          <div>
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg p-6 sticky top-24">
              <div className="flex justify-between items-start mb-2 gap-4">
                <h1 className="text-2xl font-bold text-white leading-tight">{item.title}</h1>
                {(!isLoggedIn || !isSeller) && (
                  <button 
                    onClick={handleToggleLike}
                    className={`p-3 rounded-xl transition-all shadow-lg flex-shrink-0 ${
                      item.isLiked 
                        ? 'bg-red-500 text-white' 
                        : 'bg-[#1e3a5f]/50 text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <Heart className={`w-6 h-6 ${item.isLiked ? 'fill-current' : ''}`} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-sm">{formatCategoryDisplay(item.category)}</span>
                <div className="flex items-center gap-1 text-gray-400 text-sm">
                  <Package className="w-4 h-4" />
                  <span>Free Shipping</span>
                </div>
              </div>

              {isFinished ? (
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 mb-6 text-center">
                  <div className="text-white text-sm font-bold uppercase tracking-wider mb-2">Auction Ended</div>
                  {item.winnerNickname ? (
                    <>
                      <div className="text-3xl font-black text-white mb-1">Winner: {item.winnerNickname}</div>
                      <div className="text-blue-200 text-sm">Final Price: ₩{formatPrice(item.currentPrice)}</div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold text-white">No winning bids</div>
                  )}
                </div>
              ) : (
                <div className={`bg-gradient-to-r ${isEnded ? 'from-gray-600 to-gray-700' : 'from-red-600 to-red-700'} rounded-lg p-6 mb-6`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-6 h-6 text-white" />
                    <span className="text-white text-sm font-medium">
                      {isEnded ? 'Auction Ended' : 'Time Remaining'}
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-white">
                    <CountdownTimer endTime={parseDate(item.endTime)} showSeconds />
                  </div>
                </div>
              )}

              <div className={`bg-[#1e3a5f]/30 rounded-lg p-6 mb-6 transition-all duration-500 ${flash ? 'ring-4 ring-red-500 bg-red-500/20' : ''}`}>
                <div className="text-sm text-gray-400 mb-2">
                  {isFinished ? 'Final Price' : 'Current Highest Bid'}
                </div>
                <div className="text-4xl font-bold text-blue-400 mb-1">
                  ₩{formatPrice(item.currentPrice)}
                </div>
                <div className="text-xs text-gray-500">
                  {biddingHistory.length > 0 
                    ? `by ${biddingHistory[0].bidderNickname}` 
                    : 'Initial Bid'}
                </div>
              </div>

              {!isFinished && !isEnded && (
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Your Bid Amount (KRW)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatPrice(bidAmount)}
                    onChange={(e) => setBidAmount(sanitizeNumeric(e.target.value))}
                    placeholder={`Minimum: ₩${formatPrice(item.currentPrice + 1000)}`}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-3"
                  />
                  <button
                    onClick={handlePlaceBid}
                    disabled={isBidding}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/10 disabled:opacity-50"
                  >
                    {isBidding ? 'Placing Bid...' : 'Place Bid'}
                  </button>
                </div>
              )}

              {isEnded && !isFinished && (
                <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg text-center mb-6">
                  <p className="text-gray-400 text-sm">Processing final results...</p>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 bg-[#1e3a5f]/20 px-4 py-3 rounded-lg border border-[#1e3a5f]">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Secured by AWS WAF - Network Protection Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Bidders List */}
        <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg p-6 mb-12">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Bidding Activity
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {biddingHistory.slice(0, 5).map((bid, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  index === 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-[#1e3a5f]/20 border-[#1e3a5f]/50'
                }`}
              >
                <div className="text-white font-medium mb-1">{bid.bidderNickname}</div>
                <div className="text-blue-400 font-bold text-lg mb-1">₩{bid.price.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{formatTime(bid.bidTime)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Description */}
        <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg p-6 mb-12">
          <h3 className="text-white font-semibold text-xl mb-4">Product Description</h3>
          <div className="text-gray-300 leading-relaxed space-y-4">
            <p>{item.description}</p>
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="bg-[#1e3a5f]/20 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Specifications</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Condition: Brand New</li>
                  <li>• Shipping: Free Standard Shipping</li>
                  <li>• Returns: 14-day return policy</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Q&A Section */}
        <div className="mb-12">
          <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg p-6">
            <h3 className="text-white font-semibold text-xl mb-6 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-400" />
              Questions & Answers
            </h3>

            {/* Existing Q&As */}
            <div className="space-y-6 mb-8">
              {comments.map(comment => (
                <div key={comment.id} className="border-b border-[#1e3a5f] pb-6 last:border-0">
                  <div className="mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-white font-medium mb-1">Q: {comment.content}</div>
                            <div className="text-gray-400 text-sm">
                              Asked by {comment.nickname} • {formatDate(comment.createdAt)}
                            </div>
                          </div>
                          {isSeller && (!comment.children || comment.children.length === 0) && (
                            <button 
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                              onClick={() => {
                                setReplyToId(replyToId === comment.id ? null : comment.id);
                                setReplyContent('');
                              }}
                            >
                              {replyToId === comment.id ? 'Cancel' : 'Reply'}
                            </button>
                          )}
                        </div>
                        
                        {/* Inline Reply Form for Sellers */}
                        {replyToId === comment.id && (
                          <div className="mt-4 ml-6 p-4 bg-[#1e3a5f]/30 rounded-lg border border-blue-500/20">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write your answer as a seller..."
                              rows={3}
                              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-2"
                            ></textarea>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleSubmitReply(comment.id)}
                                disabled={isSubmittingReply || !replyContent.trim()}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {isSubmittingReply && <Loader2 className="w-3 h-3 animate-spin" />}
                                Answer
                              </button>
                              <button
                                onClick={() => setReplyToId(null)}
                                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Answers (Replies) */}
                        {comment.children && comment.children.map(reply => (
                          <div key={reply.id} className="mt-4 ml-6 pl-4 border-l-2 border-blue-500/30 flex gap-3">
                            <CornerDownRight className="w-4 h-4 text-blue-500/50 mt-1 flex-shrink-0" />
                            <div>
                              <div className="text-blue-100 font-medium mb-1">A: {reply.content}</div>
                              <div className="text-gray-500 text-xs">
                                Replied by <span className="text-blue-400 font-medium">{reply.nickname}</span> (Seller) • {formatDate(reply.createdAt)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-gray-500 text-center py-8">No questions asked yet.</p>
              )}
            </div>

            {/* Ask Question Form */}
            {isLoggedIn ? (
              !isSeller ? (
                <form onSubmit={handleSubmitQuestion} className="bg-[#1e3a5f]/20 p-6 rounded-lg border border-[#1e3a5f]/50">
                  <label className="block text-white font-medium mb-3">Ask a Question</label>
                  <textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Type your question here..."
                    rows={4}
                    className="w-full px-4 py-3 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-3"
                  ></textarea>
                  <button
                    type="submit"
                    disabled={isSubmittingQuestion}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {isSubmittingQuestion ? 'Submitting...' : 'Submit Question'}
                  </button>
                </form>
              ) : (
                <div className="bg-blue-600/10 p-6 rounded-lg border border-blue-500/30 text-center">
                  <p className="text-blue-400">판매자는 본인의 상품에 질문을 남길 수 없습니다. 구매자의 문의에 답변해 주세요!</p>
                </div>
              )
            ) : (
              <div className="bg-[#1e3a5f]/20 p-8 rounded-lg border border-[#1e3a5f]/50 text-center">
                <p className="text-gray-400 mb-4">질문을 남기려면 로그인이 필요합니다.</p>
                <button
                  onClick={() => navigate('/login', { state: { from: `/product/${id}` } })}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  로그인하러 가기 &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}