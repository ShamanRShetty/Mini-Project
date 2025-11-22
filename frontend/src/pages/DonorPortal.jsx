/**
 * Donor Portal Page (FIXED VERSION)
 * 
 * Now shows transaction hashes that donors can verify
 * - Recent distributions with copyable hashes
 * - Easy verification flow
 */

import React, { useState, useEffect } from 'react';
import { donorAPI, ledgerAPI } from '../utils/api';
import { 
  Heart, Users, Package, DollarSign, RefreshCw, 
  CheckCircle, XCircle, TrendingUp, Eye, Copy, 
  ExternalLink, Hash, Clock, Search
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DonorPortal = () => {
  const [stats, setStats] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyHash, setVerifyHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, ledgerRes] = await Promise.all([
        donorAPI.getStats().catch(() => ({ data: {} })),
        ledgerAPI.getAll({ limit: 20, transactionType: 'aid_distribution' }).catch(() => ({ data: { entries: [] } }))
      ]);
      setStats(statsRes.data);
      setLedgerEntries(ledgerRes.data.entries || []);
    } catch (err) {
      console.error('Error loading donor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyTransaction = async (hashToVerify) => {
    const hash = hashToVerify || verifyHash;
    if (!hash.trim()) return;
    
    setVerifying(true);
    setVerificationResult(null);
    
    try {
      // First try to verify via donor API
      const response = await donorAPI.verifyTransaction(hash);
      setVerificationResult(response.data);
    } catch (err) {
      // If not found, try ledger verification
      try {
        const ledgerResponse = await ledgerAPI.getAll({ limit: 100 });
        const found = ledgerResponse.data.entries?.find(e => e.hash === hash);
        
        if (found) {
          setVerificationResult({
            verified: true,
            transaction: {
              hash: found.hash,
              type: found.type,
              timestamp: found.timestamp,
              description: found.description
            },
            blockchain: {
              blockNumber: found.blockNumber,
              hash: found.hash
            }
          });
        } else {
          setVerificationResult({ 
            verified: false, 
            error: 'Transaction hash not found in ledger' 
          });
        }
      } catch (ledgerErr) {
        setVerificationResult({ 
          verified: false, 
          error: 'Transaction not found' 
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = async (hash) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatHash = (hash) => {
    if (!hash || hash.length < 16) return hash || 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Value', value: `$${stats?.stats?.totalValue?.toLocaleString() || 0}`, icon: DollarSign, color: 'bg-green-500' },
    { title: 'Beneficiaries Helped', value: stats?.stats?.beneficiariesHelped || 0, icon: Users, color: 'bg-blue-500' },
    { title: 'Resources Provided', value: stats?.stats?.resourcesProvided || 0, icon: Package, color: 'bg-purple-500' },
    { title: 'Distribution Rate', value: stats?.stats?.distributionRate || '0%', icon: TrendingUp, color: 'bg-orange-500' }
  ];

  const typeData = stats?.stats?.byType?.map(t => ({
    name: t._id,
    value: t.totalQuantity
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Heart className="w-8 h-8 mr-3 text-red-500" />
            Donor Portal
          </h1>
          <p className="text-gray-600">Track your impact and verify distributions</p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Donations by Type */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Donations by Type</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {typeData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No donation data available
            </div>
          )}
        </div>

        {/* Verify Transaction */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Verify Transaction
          </h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>How to verify:</strong> Copy a transaction hash from the list below, 
              paste it here, and click Verify to confirm it's recorded on the blockchain.
            </p>
          </div>
          
          <div className="flex space-x-2 mb-4">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={verifyHash}
                onChange={(e) => setVerifyHash(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyTransaction()}
                placeholder="Paste transaction hash here..."
                className="input pl-10 font-mono text-sm"
              />
            </div>
            <button 
              onClick={() => verifyTransaction()} 
              disabled={verifying || !verifyHash.trim()}
              className="btn-primary flex items-center"
            >
              {verifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Verify
                </>
              )}
            </button>
          </div>

          {/* Verification Result */}
          {verificationResult && (
            <div className={`p-4 rounded-lg ${verificationResult.verified ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {verificationResult.verified ? (
                <div className="text-green-800">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <strong>✓ Verified on Blockchain!</strong>
                  </div>
                  <div className="text-sm space-y-1">
                    {verificationResult.transaction?.beneficiary && (
                      <p><strong>Beneficiary:</strong> {verificationResult.transaction.beneficiary}</p>
                    )}
                    {verificationResult.transaction?.date && (
                      <p><strong>Date:</strong> {new Date(verificationResult.transaction.date).toLocaleString()}</p>
                    )}
                    {verificationResult.transaction?.totalValue && (
                      <p><strong>Value:</strong> ${verificationResult.transaction.totalValue}</p>
                    )}
                    {verificationResult.blockchain?.blockNumber && (
                      <p><strong>Block #:</strong> {verificationResult.blockchain.blockNumber}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-800 flex items-center">
                  <XCircle className="w-5 h-5 mr-2" />
                  <span>{verificationResult.error || 'Transaction not found or invalid'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transaction History with Hashes */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Recent Aid Distributions (with Blockchain Hashes)
        </h3>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800">
            💡 <strong>Tip:</strong> Click the copy button next to any hash, then paste it above to verify the transaction.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">Block #</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Transaction Hash</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length > 0 ? (
                ledgerEntries.map((entry, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
                        #{entry.blockNumber}
                      </span>
                    </td>
                    <td className="py-3 text-sm">{entry.description || entry.type}</td>
                    <td className="py-3 text-sm text-gray-600">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                        {formatHash(entry.hash)}
                      </code>
                    </td>
                    <td className="py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => copyToClipboard(entry.hash)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Copy hash"
                        >
                          {copiedHash === entry.hash ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setVerifyHash(entry.hash);
                            verifyTransaction(entry.hash);
                          }}
                          className="p-1 hover:bg-blue-100 rounded transition-colors"
                          title="Verify this transaction"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-500">
                    No transactions found. Aid distributions will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Show more recent distributions from stats if available */}
        {stats?.recentAidDistributions?.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3">Your Recent Distributions</h4>
            <div className="space-y-2">
              {stats.recentAidDistributions.slice(0, 5).map((dist, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{dist.beneficiary?.name || 'Beneficiary'}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {dist.items?.map(i => `${i.quantity} ${i.itemName}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {new Date(dist.distributionDate).toLocaleDateString()}
                    </span>
                    {dist.transactionHash && (
                      <button
                        onClick={() => copyToClipboard(dist.transactionHash)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {copiedHash === dist.transactionHash ? 'Copied!' : 'Copy Hash'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonorPortal;