/**
 * Ledger Explorer Page
 * 
 * Blockchain-style ledger viewer with chain verification
 */

import React, { useState, useEffect } from 'react';
import { ledgerAPI } from '../utils/api';
import { 
  BookOpen, CheckCircle, XCircle, RefreshCw, 
  Hash, Clock, Link2, Shield, ChevronDown, ChevronUp
} from 'lucide-react';

const LedgerExplorer = () => {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        ledgerAPI.getAll({ page, limit: 20 }),
        ledgerAPI.getStats()
      ]);
      setEntries(entriesRes.data.entries || []);
      setTotalPages(entriesRes.data.pages || 1);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Error loading ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const response = await ledgerAPI.verifyChain();
      setVerificationResult(response.data);
    } catch (err) {
      setVerificationResult({ valid: false, message: 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const toggleExpand = (blockNumber) => {
    setExpandedEntry(expandedEntry === blockNumber ? null : blockNumber);
  };

  const formatHash = (hash) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-8 h-8 mr-3 text-primary-600" />
            Blockchain Ledger
          </h1>
          <p className="text-gray-600">Immutable audit trail of all transactions</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-4">
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="btn-primary"
          >
            {verifying ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Shield className="w-4 h-4 mr-2" />
            )}
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <div className={`mb-6 p-4 rounded-lg flex items-center ${
          verificationResult.valid 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {verificationResult.valid ? (
            <>
              <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <p className="font-semibold text-green-800">Chain Verified!</p>
                <p className="text-sm text-green-600">
                  {verificationResult.message} • {verificationResult.totalBlocks} blocks • 
                  {verificationResult.verificationTime}
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <p className="font-semibold text-red-800">Verification Failed</p>
                <p className="text-sm text-red-600">{verificationResult.message}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{stats?.totalBlocks || 0}</p>
          <p className="text-sm text-gray-500">Total Blocks</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{stats?.recentBlocks24h || 0}</p>
          <p className="text-sm text-gray-500">Blocks (24h)</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-600">#{stats?.latestBlockNumber || 0}</p>
          <p className="text-sm text-gray-500">Latest Block</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-orange-600">{stats?.byType?.length || 0}</p>
          <p className="text-sm text-gray-500">Transaction Types</p>
        </div>
      </div>

      {/* Ledger Entries */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Ledger Entries</h2>
        
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.blockNumber}
              className="border rounded-lg overflow-hidden"
            >
              {/* Entry Header */}
              <div
                onClick={() => toggleExpand(entry.blockNumber)}
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <span className="text-primary-700 font-bold">#{entry.blockNumber}</span>
                  </div>
                  <div>
                    <p className="font-medium capitalize">{entry.type?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-mono text-gray-600">{formatHash(entry.hash)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {expandedEntry === entry.blockNumber ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedEntry === entry.blockNumber && (
                <div className="p-4 bg-white border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1 flex items-center">
                        <Hash className="w-4 h-4 mr-1" /> Block Hash
                      </p>
                      <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                        {entry.hash}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1 flex items-center">
                        <Link2 className="w-4 h-4 mr-1" /> Previous Hash
                      </p>
                      <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                        {entry.previousHash || 'Genesis Block'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1 flex items-center">
                        <Clock className="w-4 h-4 mr-1" /> Timestamp
                      </p>
                      <p>{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Transaction Type</p>
                      <p className="capitalize">{entry.type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerExplorer;