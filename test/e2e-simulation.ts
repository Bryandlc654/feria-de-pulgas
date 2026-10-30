import { io } from 'socket.io-client';

async function runE2ETest() {
  console.log('🧪 Starting Feria de Pulgas E2E Multiplayer Test...');
  const serverUrl = 'http://localhost:3001';

  // 1. Player 1 Connects
  const socket1 = io(serverUrl);
  const socket2 = io(serverUrl);

  await new Promise<void>((res) => { socket1.on('connect', () => res()); });
  await new Promise<void>((res) => { socket2.on('connect', () => res()); });
  console.log('✅ Both players connected via Socket.io');

  // 2. Player 1 creates room
  const createRes: any = await new Promise((resolve) => {
    socket1.emit(
      'room:create',
      { nickname: 'Vendedor Pepe', avatar: '🎩', roomName: 'Feria E2E Test', targetScore: 300 },
      resolve
    );
  });

  if (!createRes.success) throw new Error('Create room failed: ' + createRes.error);
  const roomCode = createRes.roomCode;
  const p1 = createRes.player;
  console.log(`✅ Room created with code: ${roomCode} by ${p1.nickname}`);

  // 3. Player 2 joins room
  const joinRes: any = await new Promise((resolve) => {
    socket2.emit(
      'room:join',
      { roomCode, nickname: 'Compradora Ana', avatar: '🏺' },
      resolve
    );
  });

  if (!joinRes.success) throw new Error('Join room failed: ' + joinRes.error);
  const p2 = joinRes.player;
  console.log(`✅ ${p2.nickname} joined room ${roomCode}`);

  // Setup hand tracking
  let p1Hand: any[] = [];
  let p2Hand: any[] = [];

  socket1.on('hand:updated', (state: any) => {
    p1Hand = state.hand;
  });
  socket2.on('hand:updated', (state: any) => {
    p2Hand = state.hand;
  });

  // 4. Start game
  const startRes: any = await new Promise((resolve) => {
    socket1.emit('game:start', resolve);
  });
  if (!startRes.success) throw new Error('Game start failed: ' + startRes.error);
  console.log('✅ Game started, waiting for cards deal...');

  // Wait a fraction of a second for dealing
  await new Promise((r) => setTimeout(r, 500));

  console.log(`✅ Player 1 dealt ${p1Hand.length} cards.`);
  console.log(`✅ Player 2 dealt ${p2Hand.length} cards.`);

  if (p1Hand.length !== 9 || p2Hand.length !== 9) {
    throw new Error('Expected 9 cards each!');
  }

  // 5. Anti-Cheat test: Try offering 2 cards of different suits
  let cardDiff1 = p1Hand[0];
  let cardDiff2 = p1Hand.find((c) => c.suit !== cardDiff1.suit);

  if (cardDiff2) {
    const invalidOfferRes: any = await new Promise((resolve) => {
      socket1.emit('trade:offer', { cardIds: [cardDiff1.id, cardDiff2.id] }, resolve);
    });
    if (invalidOfferRes.success) {
      throw new Error('Anti-cheat failed! Player offered mixed suits and server accepted.');
    }
    console.log('🛡️ Anti-cheat verified: server correctly rejected mixed-suit bundle:', invalidOfferRes.error);
  }

  // 6. Valid Simultaneous Trade test
  // Find cards of same suit for Player 1
  const p1SuitCounts: Record<string, any[]> = {};
  p1Hand.forEach((c) => {
    p1SuitCounts[c.suit] = p1SuitCounts[c.suit] || [];
    p1SuitCounts[c.suit].push(c.id);
  });
  const p1OfferIds = Object.values(p1SuitCounts).find((arr) => arr.length >= 2)?.slice(0, 2);

  // Find cards of same suit for Player 2
  const p2SuitCounts: Record<string, any[]> = {};
  p2Hand.forEach((c) => {
    p2SuitCounts[c.suit] = p2SuitCounts[c.suit] || [];
    p2SuitCounts[c.suit].push(c.id);
  });
  const p2OfferIds = Object.values(p2SuitCounts).find((arr) => arr.length >= 2)?.slice(0, 2);

  if (!p1OfferIds || !p2OfferIds) {
    console.log('Skipping 2-card offer test (players had unique singles), testing 1-card offer...');
  }

  const p1OfferCards = p1OfferIds || [p1Hand[0].id];
  const p2OfferCards = p2OfferIds || [p2Hand[0].id];
  const tradeCount = Math.min(p1OfferCards.length, p2OfferCards.length);

  // Player 1 offers
  const offerRes1: any = await new Promise((resolve) => {
    socket1.emit('trade:offer', { cardIds: p1OfferCards.slice(0, tradeCount) }, resolve);
  });
  if (!offerRes1.success) throw new Error('Player 1 offer failed: ' + offerRes1.error);
  console.log(`✅ Player 1 shouted offer of ${tradeCount} cards.`);

  // Player 2 offers
  const offerRes2: any = await new Promise((resolve) => {
    socket2.emit('trade:offer', { cardIds: p2OfferCards.slice(0, tradeCount) }, resolve);
  });
  if (!offerRes2.success) throw new Error('Player 2 offer failed: ' + offerRes2.error);
  console.log(`✅ Player 2 shouted offer of ${tradeCount} cards.`);

  // Player 2 accepts trade with Player 1
  const tradeRes: any = await new Promise((resolve) => {
    socket2.emit('trade:accept', { targetPlayerId: p1.id }, resolve);
  });
  if (!tradeRes.success) throw new Error('Trade execution failed: ' + tradeRes.error);
  console.log(`🤝 Trade completed successfully! Swapped ${tradeCount} cards simultaneously without reload.`);

  // 7. Reconnection test
  console.log('🔌 Testing player reconnection...');
  socket2.disconnect();

  const socket2Reconnect = io(serverUrl);
  await new Promise<void>((res) => { socket2Reconnect.on('connect', () => res()); });

  const reconnectRes: any = await new Promise((resolve) => {
    socket2Reconnect.emit(
      'room:reconnect',
      { roomCode, playerId: p2.id, token: p2.token },
      resolve
    );
  });

  if (!reconnectRes.success) throw new Error('Reconnection failed: ' + reconnectRes.error);
  console.log(`⚡ Player 2 successfully reconnected and restored hand (${reconnectRes.handState.hand.length} cards)!`);

  // 8. Premature win claim anti-cheat test
  const claimRes: any = await new Promise((resolve) => {
    socket1.emit('game:claim_win', resolve);
  });
  if (claimRes.success) {
    throw new Error('Anti-cheat failed: win claimed without 9 identical cards!');
  }
  console.log('🛡️ Win claim anti-cheat verified: premature claim rejected properly:', claimRes.error);

  console.log('🎉 ALL MULTIPLAYER E2E TESTS PASSED WITH 100% SUCCESS!');

  socket1.disconnect();
  socket2Reconnect.disconnect();
  process.exit(0);
}

runE2ETest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
