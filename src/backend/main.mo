import Map "mo:core/Map";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Char "mo:core/Char";
import Order "mo:core/Order";
import VarArray "mo:core/VarArray";


// Upgrade with migration.

actor {
  type AnswerMode = {
    #strict;
    #smart;
  };

  type AnswerStatus = {
    #correct;
    #almost;
    #wrong;
  };

  type QuizStatus = {
    #waiting;
    #live;
    #finished;
  };

  type Submission = {
    username : Text;
    answer : Text;
    timestamp : Int;
    answerStatus : AnswerStatus;
  };

  type QuizState = {
    question : Text;
    correctAnswers : [Text];
    timerSeconds : Nat;
    startTime : Int;
    mode : AnswerMode;
    submissions : [Submission];
    winner : ?Text;
    status : QuizStatus;
  };

  type QuizStatePublic = {
    question : Text;
    timerSeconds : Nat;
    startTime : Int;
    submissions : [Submission];
    winner : ?Text;
    status : QuizStatus;
  };

  type QuizStateAdmin = {
    question : Text;
    correctAnswers : [Text];
    timerSeconds : Nat;
    mode : AnswerMode;
    startTime : Int;
    submissions : [Submission];
    winner : ?Text;
    status : QuizStatus;
    totalActivePlayers : Nat;
    suspiciousUsers : [Text];
  };

  type QuizError = {
    #quizNotLive;
    #quizAlreadyHasWinner;
    #answerNotAccepted : Text;
    #answerLimitExceeded;
    #insufficientCoins;
  };

  type JoinError = {
    #wrongRoomCode;
    #playerBlocked;
    #playerKicked;
    #nameTaken;
    #invalidName;
  };

  type ScoreboardEntry = {
    username : Text;
    wins : Nat;
    streak : Nat;
  };

  type WinEntry = {
    username : Text;
    timeTaken : Int;
  };

  type ScoreboardData = {
    scoreboard : [ScoreboardEntry];
    winHistory : [WinEntry];
  };

  type RoundLogEntry = {
    roundNumber : Nat;
    question : Text;
    winner : ?Text;
    timeTaken : ?Int;
    totalSubmissions : Nat;
  };

  type PlayerReferral = {
    username : Text;
    referredBy : Text;
  };

  type ReferralCount = {
    inviter : Text;
    count : Nat;
  };

  type AdminExtras = {
    roomCode : Text;
    kickedPlayers : [Text];
    blockedPlayers : [Text];
    activePlayers : Nat;
    suspiciousUsers : [Text];
    roundLog : [RoundLogEntry];
    playerReferrals : [PlayerReferral];
  };

  // ─── Wallet & Withdrawal types ───────────────────────────────────────────────

  type PlayerWallet = {
    totalEarned : Nat;
    pendingBalance : Nat;
    totalWithdrawn : Nat;
  };

  type WithdrawalStatus = {
    #pending;
    #paid;
  };

  type WithdrawalRequest = {
    id : Nat;
    username : Text;
    amount : Nat;
    upiId : Text;
    requestedAt : Int;
    status : WithdrawalStatus;
  };

  type WithdrawalError = {
    #insufficientBalance;
    #pendingRequestExists;
    #cooldownActive;
    #invalidUpiId;
  };

  // New types for quiz bank/auto mode feature
  type QuizQuestion = {
    id : Nat;
    category : Text;
    question : Text;
    correctAnswers : Text;
    mode : AnswerMode;
  };

  type AutoModeSettings = {
    enabled : Bool;
    rewardAmount : Nat;
    timerSeconds : Nat;
  };

  type AutoRoundResult = {
    state : QuizStatePublic;
    category : Text;
    questionId : Nat;
  };

  // ─── Coin system types ───────────────────────────────────────────────────────

  type CoinSettings = {
    entryFee : Nat;
    winBonus : Nat;
  };

  type FreeCoinsResult = {
    #ok : Nat;
    #err : {
      #cooldownActive;
    };
  };

  // ─── Core state ──────────────────────────────────────────────────────────────

  var quizState : QuizState = {
    question = "";
    correctAnswers = [];
    mode = #strict;
    timerSeconds = 0;
    startTime = 0;
    submissions = [];
    winner = null;
    status = #waiting;
  };

  let userLastSubmissionTime = Map.empty<Text, Int>();

  let playerWins = Map.empty<Text, Nat>();
  let playerStreaks = Map.empty<Text, Nat>();
  var winHistory : [WinEntry] = [];

  // ─── Coin system state ─────────────────────────────────────────────────────

  let playerCoins = Map.empty<Text, Nat>();
  let playerRoundCoinDeducted = Map.empty<Text, Bool>();
  let lastFreeCoinsTime = Map.empty<Text, Int>();
  var coinEntryFee = 0;
  var coinWinBonus = 20;

  // ─── Persistent maps for new features ───────────────

  let usedQuestionIds = Map.empty<Nat, Bool>();

  // ─── Session / anti-abuse state ────────────────────

  var roomCode : Text = "1234";
  let blockedPlayers = Map.empty<Text, Bool>();
  let kickedPlayers = Map.empty<Text, Bool>();
  let activePlayerMap = Map.empty<Text, Int>();
  let playerRoundAnswerCount = Map.empty<Text, Nat>();
  let playerSubmissionTimestamps = Map.empty<Text, [Int]>();
  let suspiciousUserMap = Map.empty<Text, Bool>();
  var roundLog : [RoundLogEntry] = [];
  var roundNumber : Nat = 0;

  // Referral tracking
  let playerReferrals = Map.empty<Text, Text>();

  // ─── Persistent state for new features ───────────────

  var autoModeEnabled : Bool = false;
  var autoModeReward : Nat = 50;
  var autoModeTimerSeconds : Nat = 20;

  // ─── Wallet & Withdrawal state ─────────────────────────
  let playerWallets = Map.empty<Text, PlayerWallet>();
  var withdrawalRequests : [WithdrawalRequest] = [];
  var nextRequestId : Nat = 0;
  var minWithdrawalAmount : Nat = 100;
  let lastWithdrawalRequestTime = Map.empty<Text, Int>();
  var currentRoundReward : Nat = 0;

  // ─── Question bank entries (52) ────────────────────────

  let questionBank : [QuizQuestion] = [
    // General Knowledge (13)
    {
      id = 1;
      category = "General Knowledge";
      question = "What is the capital of France?";
      correctAnswers = "paris, city of light";
      mode = #smart;
    },
    {
      id = 2;
      category = "General Knowledge";
      question = "Who painted the Mona Lisa?";
      correctAnswers = "leonardo da vinci, da vinci, leonardo";
      mode = #smart;
    },
    {
      id = 3;
      category = "General Knowledge";
      question = "Which planet is known as the Red Planet?";
      correctAnswers = "mars, red planet";
      mode = #smart;
    },
    {
      id = 4;
      category = "General Knowledge";
      question = "What is the largest ocean on Earth?";
      correctAnswers = "pacific ocean, pacific";
      mode = #smart;
    },
    {
      id = 5;
      category = "General Knowledge";
      question = "Who wrote 'Romeo and Juliet'?";
      correctAnswers = "william shakespeare, shakespeare";
      mode = #smart;
    },
    {
      id = 6;
      category = "General Knowledge";
      question = "What is the chemical symbol for Gold?";
      correctAnswers = "au";
      mode = #strict;
    },
    {
      id = 7;
      category = "General Knowledge";
      question = "Which country invented pizza?";
      correctAnswers = "italy, italian, italian food";
      mode = #smart;
    },
    {
      id = 8;
      category = "General Knowledge";
      question = "How many continents are there?";
      correctAnswers = "seven, 7";
      mode = #smart;
    },
    {
      id = 9;
      category = "General Knowledge";
      question = "Who discovered penicillin?";
      correctAnswers = "alexander fleming, fleming";
      mode = #smart;
    },
    {
      id = 10;
      category = "General Knowledge";
      question = "What is the largest mammal in the world?";
      correctAnswers = "blue whale, whale, mammal";
      mode = #smart;
    },
    {
      id = 11;
      category = "General Knowledge";
      question = "What is the capital of Japan?";
      correctAnswers = "tokyo";
      mode = #smart;
    },
    {
      id = 12;
      category = "General Knowledge";
      question = "Who is the author of 'Harry Potter' series?";
      correctAnswers = "jk rowling, j.k. rowling, rowling";
      mode = #smart;
    },
    {
      id = 13;
      category = "General Knowledge";
      question = "Which is the tallest mountain in the world?";
      correctAnswers = "mount everest, everest, tallest mountain";
      mode = #smart;
    },
    // Football (13)
    {
      id = 14;
      category = "Football";
      question = "Which country has won the most FIFA World Cups?";
      correctAnswers = "brazil, most world cups";
      mode = #smart;
    },
    {
      id = 15;
      category = "Football";
      question = "Who is the all-time top scorer in the Premier League?";
      correctAnswers = "alan shearer, shearer, top scorer";
      mode = #smart;
    },
    {
      id = 16;
      category = "Football";
      question = "Which club has won the most UEFA Champions League titles?";
      correctAnswers = "real madrid, most titles";
      mode = #smart;
    },
    {
      id = 17;
      category = "Football";
      question = "Who won the Ballon d'Or in 2021?";
      correctAnswers = "lionel messi, messi, 2021";
      mode = #smart;
    },
    {
      id = 18;
      category = "Football";
      question = "Which player holds the record for most World Cup goals?";
      correctAnswers = "miroslav klose, klose, world cup";
      mode = #smart;
    },
    {
      id = 19;
      category = "Football";
      question = "Who is the manager of Manchester City (2022)?";
      correctAnswers = "pep guardiola, guardiola, man city";
      mode = #smart;
    },
    {
      id = 20;
      category = "Football";
      question = "Which country hosted the 2018 FIFA World Cup?";
      correctAnswers = "russia, host country";
      mode = #smart;
    },
    {
      id = 21;
      category = "Football";
      question = "Who scored the 'Hand of God' goal in 1986?";
      correctAnswers = "diego maradona, maradona, hand of god";
      mode = #smart;
    },
    {
      id = 22;
      category = "Football";
      question = "Which English club is known as the 'Reds'?";
      correctAnswers = "liverpool, liverpool fc, reds";
      mode = #smart;
    },
    {
      id = 23;
      category = "Football";
      question = "Who is known as 'The Special One'?";
      correctAnswers = "jose mourinho, mourinho, special one";
      mode = #smart;
    },
    {
      id = 24;
      category = "Football";
      question = "Which country won Euro 2016?";
      correctAnswers = "portugal, euro 2016";
      mode = #smart;
    },
    {
      id = 25;
      category = "Football";
      question = "Who is Barcelona's all-time top scorer?";
      correctAnswers = "lionel messi, messi, top scorer";
      mode = #smart;
    },
    {
      id = 26;
      category = "Football";
      question = "Which player is nicknamed 'CR7'?";
      correctAnswers = "cristiano ronaldo, cr7, ronaldo";
      mode = #smart;
    },
    // Gaming (13)
    {
      id = 27;
      category = "Gaming";
      question = "What year was the first PlayStation released?";
      correctAnswers = "1994, playstation, gaming";
      mode = #smart;
    },
    {
      id = 28;
      category = "Gaming";
      question = "Who is the main character in The Legend of Zelda?";
      correctAnswers = "link, zelda, character";
      mode = #smart;
    },
    {
      id = 29;
      category = "Gaming";
      question = "What is the best-selling video game of all time?";
      correctAnswers = "minecraft, best selling, video game";
      mode = #smart;
    },
    {
      id = 30;
      category = "Gaming";
      question = "Who is the creator of Super Mario?";
      correctAnswers = "shigeru miyamoto, miyamoto, super mario";
      mode = #smart;
    },
    {
      id = 31;
      category = "Gaming";
      question = "Which company developed Fortnite?";
      correctAnswers = "epic games, fortnite, gaming";
      mode = #smart;
    },
    {
      id = 32;
      category = "Gaming";
      question = "What is the highest-selling Nintendo console?";
      correctAnswers = "nintendo switch, switch, nintendo, console";
      mode = #smart;
    },
    {
      id = 33;
      category = "Gaming";
      question = "Who is the protagonist of Halo series?";
      correctAnswers = "master chief, halo, protagonist";
      mode = #smart;
    },
    {
      id = 34;
      category = "Gaming";
      question = "What year was Minecraft released?";
      correctAnswers = "2011, minecraft, release year";
      mode = #smart;
    },
    {
      id = 35;
      category = "Gaming";
      question = "What is the name of Sonic's sidekick?";
      correctAnswers = "tails, sonic, sidekick";
      mode = #smart;
    },
    {
      id = 36;
      category = "Gaming";
      question = "Which game features the city of Liberty City?";
      correctAnswers = "gta, grand theft auto, liberty city";
      mode = #smart;
    },
    {
      id = 37;
      category = "Gaming";
      question = "Who is the creator of Half-Life series?";
      correctAnswers = "valve, half-life, creator";
      mode = #smart;
    },
    {
      id = 38;
      category = "Gaming";
      question = "What is the currency in Fortnite?";
      correctAnswers = "v-bucks, fortnite, gaming";
      mode = #smart;
    },
    {
      id = 39;
      category = "Gaming";
      question = "Which game series features characters like Peach and Bowser?";
      correctAnswers = "super mario, mario";
      mode = #smart;
    },
    // Movies (13)
    {
      id = 40;
      category = "Movies";
      question = "Who directed 'Inception'?";
      correctAnswers = "christopher nolan, nolan, inception";
      mode = #smart;
    },
    {
      id = 41;
      category = "Movies";
      question = "Which movie won the Most Oscars?";
      correctAnswers = "titanic, lord of the rings, ben-hur";
      mode = #smart;
    },
    {
      id = 42;
      category = "Movies";
      question = "Who played Joker in 'The Dark Knight'?";
      correctAnswers = "heath ledger, ledger, joker";
      mode = #smart;
    },
    {
      id = 43;
      category = "Movies";
      question = "What is the highest-grossing film of all time?";
      correctAnswers = "avatar, highest grossing";
      mode = #smart;
    },
    {
      id = 44;
      category = "Movies";
      question = "Who is the main character in 'The Matrix'?";
      correctAnswers = "neo, keanu reeves, matrix, character";
      mode = #smart;
    },
    {
      id = 45;
      category = "Movies";
      question = "Which director made 'Pulp Fiction'?";
      correctAnswers = "quentin tarantino, tarantino, director";
      mode = #smart;
    },
    {
      id = 46;
      category = "Movies";
      question = "Who played Tony Stark in the Marvel movies?";
      correctAnswers = "robert downey jr, downey, tony stark";
      mode = #smart;
    },
    {
      id = 47;
      category = "Movies";
      question = "Which movie features the song 'Let It Go'?";
      correctAnswers = "frozen, let it go, movie";
      mode = #smart;
    },
    {
      id = 48;
      category = "Movies";
      question = "Who directed 'The Lord of the Rings' trilogy?";
      correctAnswers = "peter jackson, jackson, lord of the rings";
      mode = #smart;
    },
    {
      id = 49;
      category = "Movies";
      question = "Who played Jack in Titanic?";
      correctAnswers = "leonardo dicaprio, dicaprio, jack";
      mode = #smart;
    },
    {
      id = 50;
      category = "Movies";
      question = "Which movie features the character 'Forrest Gump'?";
      correctAnswers = "tom hanks, forrest gump, character";
      mode = #smart;
    },
    {
      id = 51;
      category = "Movies";
      question = "Who directed 'Jurassic Park'?";
      correctAnswers = "steven spielberg, spielberg, jurassic park";
      mode = #smart;
    },
    {
      id = 52;
      category = "Movies";
      question = "What is the longest-running movie franchise?";
      correctAnswers = "james bond, james bond franchise";
      mode = #smart;
    },
  ];

  // ─── Answer matching helpers ────────────────────────────

  func normalizeAnswer(answer : Text) : Text {
    answer.toLower().toArray().filter(
      func(c) {
        (c >= 'a' and c <= 'z') or (c >= '0' and c <= '9');
      }
    ).toText();
  };

  func levenshtein(a : Text, b : Text) : Nat {
    let aChars = a.toArray();
    let bChars = b.toArray();
    let aLimited = if (aChars.size() > 20) { aChars.sliceToArray(0, 20) } else { aChars };
    let bLimited = if (bChars.size() > 20) { bChars.sliceToArray(0, 20) } else { bChars };
    let m = aLimited.size();
    let n = bLimited.size();
    if (m == 0) { return n };
    if (n == 0) { return m };
    let prev = VarArray.tabulate<Nat>(n + 1, func(i) { i });
    let curr = VarArray.repeat<Nat>(0, n + 1);
    var i = 1;
    while (i <= m) {
      curr[0] := i;
      var j = 1;
      while (j <= n) {
        let cost = if (aLimited[i - 1] == bLimited[j - 1]) { 0 } else { 1 };
        curr[j] := Nat.min(Nat.min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
        j += 1;
      };
      var k = 0;
      while (k < n + 1) {
        prev[k] := curr[k];
        k += 1;
      };
      i += 1;
    };
    prev[n];
  };

  func splitAnswers(raw : Text) : [Text] {
    if (raw.size() == 0) { return [] };
    let parts = raw.split(#char ',').toArray();
    parts.map(
      func(part) {
        normalizeAnswer(part.trim(#char ' '));
      }
    ).filter(
      func(s) { s != "" }
    );
  };

  func matchAnswer(input : Text, correctAnswers : [Text], mode : AnswerMode) : AnswerStatus {
    let normalizedInput = normalizeAnswer(input);
    for (variant in correctAnswers.values()) {
      if (normalizedInput == variant) { return #correct };
      switch (mode) {
        case (#smart) {
          if (normalizedInput.contains(#text(variant)) or variant.contains(#text(normalizedInput))) {
            return #correct;
          };
        };
        case (#strict) {};
      };
    };
    switch (mode) {
      case (#smart) {
        for (variant in correctAnswers.values()) {
          if (levenshtein(normalizedInput, variant) <= 2) { return #almost };
        };
      };
      case (#strict) {};
    };
    #wrong;
  };

  func isQuizExpired(state : QuizState) : Bool {
    let now = Time.now();
    now >= state.startTime + (state.timerSeconds * 1_000_000_000);
  };

  func sanitizeState(state : QuizState) : QuizStatePublic {
    {
      question = state.question;
      timerSeconds = state.timerSeconds;
      startTime = state.startTime;
      submissions = state.submissions;
      winner = state.winner;
      status = if (state.status == #live and isQuizExpired(state)) { #finished } else { state.status };
    };
  };

  func compareScoreboardEntry(a : ScoreboardEntry, b : ScoreboardEntry) : Order.Order {
    Nat.compare(b.wins, a.wins);
  };

  // Append a round log entry (max 10 kept)
  func appendRoundLog(winner : ?Text, timeTaken : ?Int) {
    roundNumber += 1;
    let entry : RoundLogEntry = {
      roundNumber;
      question = quizState.question;
      winner;
      timeTaken;
      totalSubmissions = quizState.submissions.size();
    };
    let updated = [entry].concat(roundLog);
    roundLog := if (updated.size() > 10) { updated.sliceToArray(0, 10) } else { updated };
  };

  func compareReferralCount(a : ReferralCount, b : ReferralCount) : Order.Order {
    Nat.compare(b.count, a.count);
  };

  // ─── Room code ───────────────────────────────────────

  func makeRoomCode() : Text {
    let t = Int.abs(Time.now());
    let n = t % 9000 + 1000;
    n.toText();
  };

  public shared ({ caller }) func generateRoomCode() : async Text {
    roomCode := makeRoomCode();
    roomCode;
  };

  // ─── Session management ──────────────────────────────

  public shared ({ caller }) func joinSession(username : Text, code : Text, referredBy : Text) : async {
    #ok : Text;
    #err : JoinError;
  } {
    if (username.size() < 2 or username.size() > 32) {
      return #err(#invalidName);
    };
    if (code != roomCode) {
      return #err(#wrongRoomCode);
    };
    if (blockedPlayers.get(username) == ?true) {
      return #err(#playerBlocked);
    };
    if (kickedPlayers.get(username) == ?true) {
      return #err(#playerKicked);
    };
    switch (activePlayerMap.get(username)) {
      case (?_) { return #err(#nameTaken) };
      case (null) {};
    };
    activePlayerMap.add(username, Time.now());
    // Track referral source and count in map. Use "Direct" if empty
    let refSource = if (referredBy.size() == 0) { "Direct" } else { referredBy };
    playerReferrals.add(username, refSource);
    // Track starting coins if user has never played
    if (not playerCoins.containsKey(username)) {
      playerCoins.add(username, 50);
    };
    #ok(username);
  };

  // ─── Admin control ───────────────────────────────────

  public shared ({ caller }) func kickPlayer(username : Text) : async () {
    kickedPlayers.add(username, true);
    activePlayerMap.remove(username);
  };

  public shared ({ caller }) func blockPlayer(username : Text) : async () {
    blockedPlayers.add(username, true);
    kickedPlayers.add(username, true);
    activePlayerMap.remove(username);
  };

  public shared ({ caller }) func unblockPlayer(username : Text) : async () {
    blockedPlayers.remove(username);
  };

  public shared ({ caller }) func endRound() : async () {
    if (quizState.status == #live or quizState.status == #waiting) {
      appendRoundLog(null, null);
      quizState := { quizState with status = #finished };
    };
  };

  // ─── Quiz lifecycle ──────────────────────────────────

  public shared ({ caller }) func startQuiz(question : Text, correctAnswers : Text, timerSeconds : Nat, mode : AnswerMode, rewardAmount : Nat) : async {
    #ok : QuizStatePublic;
  } {
    let answersArray = splitAnswers(correctAnswers);
    if (answersArray.size() == 0) { return #ok(sanitizeState(quizState)) };
    currentRoundReward := rewardAmount;
    quizState := {
      question;
      correctAnswers = answersArray;
      timerSeconds;
      startTime = Time.now();
      submissions = [];
      winner = null;
      status = #live;
      mode;
    };
    #ok(sanitizeState(quizState));
  };

  public shared ({ caller }) func startNewRound(question : Text, correctAnswers : Text, timerSeconds : Nat, mode : AnswerMode, rewardAmount : Nat) : async {
    #ok : QuizStatePublic;
  } {
    let answersArray = splitAnswers(correctAnswers);
    if (answersArray.size() == 0) { return #ok(sanitizeState(quizState)) };
    currentRoundReward := rewardAmount;
    quizState := {
      question;
      correctAnswers = answersArray;
      timerSeconds;
      startTime = Time.now();
      submissions = [];
      winner = null;
      status = #live;
      mode;
    };
    // Clear per-round state (keep streaks, wins, blocked, roomCode, wallets)
    userLastSubmissionTime.clear();
    kickedPlayers.clear();
    playerRoundAnswerCount.clear();
    playerSubmissionTimestamps.clear();
    suspiciousUserMap.clear();
    activePlayerMap.clear();
    playerReferrals.clear();
    playerRoundCoinDeducted.clear();
    #ok(sanitizeState(quizState));
  };

  // ─── Coin system answers + balance update  ──────

  public shared ({ caller }) func submitAnswer(username : Text, answer : Text) : async {
    #ok : QuizStatePublic;
    #err : QuizError;
  } {
    if (quizState.status != #live) {
      return #err(#quizNotLive);
    };

    let now = Time.now();

    // 2-second cooldown
    switch (userLastSubmissionTime.get(username)) {
      case (?lastTime) {
        if (now < lastTime + 2_000_000_000) {
          return #err(#answerNotAccepted("Must wait 2 seconds before submitting again."));
        };
      };
      case (null) {};
    };

    // Per-round answer cap (10 max)
    let answerCount = switch (playerRoundAnswerCount.get(username)) {
      case (null) { 0 };
      case (?c) { c };
    };
    if (answerCount >= 10) {
      return #err(#answerLimitExceeded);
    };
    playerRoundAnswerCount.add(username, answerCount + 1);

    // Coin system: check entry fee
    if (coinEntryFee > 0) {
      let coins = switch (playerCoins.get(username)) {
        case (null) { 0 };
        case (?c) { c };
      };
      if (coins < coinEntryFee) {
        return #err(#insufficientCoins);
      };
      // Deduct entry fee if not already deducted this round
      switch (playerRoundCoinDeducted.get(username)) {
        case (null) {
          playerCoins.add(username, coins - coinEntryFee);
          playerRoundCoinDeducted.add(username, true);
        };
        case (?deducted) {
          // If already deducted, do nothing
          if (not deducted) {
            playerCoins.add(username, coins - coinEntryFee);
            playerRoundCoinDeducted.add(username, true);
          };
        };
      };
    };

    let windowNs : Int = 5_000_000_000;
    let prevTimestamps = switch (playerSubmissionTimestamps.get(username)) {
      case (null) { [] };
      case (?ts) { ts };
    };
    let recentTimestamps = prevTimestamps.filter(func(t : Int) : Bool { now - t <= windowNs });
    let newTimestamps = recentTimestamps.concat([now]);
    let tsSize = newTimestamps.size();
    let trimmedTimestamps : [Int] = if (tsSize > 10) {
      newTimestamps.sliceToArray(Nat.sub(tsSize, 10), tsSize);
    } else { newTimestamps };
    playerSubmissionTimestamps.add(username, trimmedTimestamps);
    if (trimmedTimestamps.size() >= 3) {
      suspiciousUserMap.add(username, true);
    };

    activePlayerMap.add(username, now);

    let answerStatus = matchAnswer(answer, quizState.correctAnswers, quizState.mode);

    let submission : Submission = {
      answer;
      timestamp = now;
      username;
      answerStatus;
    };

    switch (answerStatus) {
      case (#correct) {
        if (quizState.winner != null) {
          return #err(#quizAlreadyHasWinner);
        };

        let currentWins = switch (playerWins.get(username)) {
          case (null) { 0 };
          case (?w) { w };
        };
        playerWins.add(username, currentWins + 1);

        let winnerCurrentStreak = switch (playerStreaks.get(username)) {
          case (null) { 0 };
          case (?s) { s };
        };
        for ((player, _streak) in playerStreaks.entries()) {
          playerStreaks.add(player, 0);
        };
        playerStreaks.add(username, winnerCurrentStreak + 1);

        // Credit wallet if reward > 0
        if (currentRoundReward > 0) {
          let currentWallet = switch (playerWallets.get(username)) {
            case (null) { { totalEarned = 0; pendingBalance = 0; totalWithdrawn = 0 } };
            case (?w) { w };
          };
          playerWallets.add(username, {
            totalEarned = currentWallet.totalEarned + currentRoundReward;
            pendingBalance = currentWallet.pendingBalance + currentRoundReward;
            totalWithdrawn = currentWallet.totalWithdrawn;
          });
        };

        // Add coin bonus to winner
        let coins = switch (playerCoins.get(username)) {
          case (null) { 0 };
          case (?c) { c };
        };
        playerCoins.add(username, coins + coinWinBonus);

        let timeTaken = now - quizState.startTime;
        let newEntry : WinEntry = { username; timeTaken };
        let updated = [newEntry].concat(winHistory);
        winHistory := if (updated.size() > 5) { updated.sliceToArray(0, 5) } else { updated };

        appendRoundLog(?username, ?timeTaken);

        quizState := {
          quizState with
          submissions = quizState.submissions.concat([submission]);
          winner = ?username;
          status = #finished;
        };
      };
      case (#almost or #wrong) {
        userLastSubmissionTime.add(username, now);
        quizState := {
          quizState with
          submissions = quizState.submissions.concat([submission]);
        };
      };
    };
    #ok(sanitizeState(quizState));
  };

  // ─── New coin system functions ─────────────

  public query ({ caller }) func getCoinBalance(username : Text) : async Nat {
    switch (playerCoins.get(username)) {
      case (null) { 0 };
      case (?c) { c };
    };
  };

  public query ({ caller }) func getCoinSettings() : async CoinSettings {
    { entryFee = coinEntryFee; winBonus = coinWinBonus };
  };

  public shared ({ caller }) func setCoinEntryFee(fee : Nat) : async () {
    coinEntryFee := fee;
  };

  public shared ({ caller }) func setCoinWinBonus(bonus : Nat) : async () {
    coinWinBonus := bonus;
  };

  public shared ({ caller }) func claimFreeCoins(username : Text) : async FreeCoinsResult {
    let cooldownNs : Int = 30 * 60 * 1_000_000_000;
    let now = Time.now();
    switch (lastFreeCoinsTime.get(username)) {
      case (?lastTime) {
        if (now - lastTime < cooldownNs) {
          return #err(#cooldownActive);
        };
      };
      case (null) {};
    };
    let coins = switch (playerCoins.get(username)) {
      case (null) { 0 };
      case (?c) { c };
    };
    playerCoins.add(username, coins + 10);
    lastFreeCoinsTime.add(username, now);
    #ok(coins + 10);
  };

  // ─── Wallet queries ─────────────────────

  public query ({ caller }) func getWallet(username : Text) : async PlayerWallet {
    switch (playerWallets.get(username)) {
      case (null) { { totalEarned = 0; pendingBalance = 0; totalWithdrawn = 0 } };
      case (?w) { w };
    };
  };

  // ─── Withdrawal ─────────────────────────────

  public shared ({ caller }) func requestWithdrawal(username : Text, upiId : Text) : async {
    #ok;
    #err : WithdrawalError;
  } {
    if (upiId.size() == 0) {
      return #err(#invalidUpiId);
    };

    let wallet = switch (playerWallets.get(username)) {
      case (null) { { totalEarned = 0; pendingBalance = 0; totalWithdrawn = 0 } };
      case (?w) { w };
    };

    if (wallet.pendingBalance < minWithdrawalAmount) {
      return #err(#insufficientBalance);
    };

    // Check 24h cooldown
    let now = Time.now();
    let cooldownNs : Int = 24 * 3600 * 1_000_000_000;
    switch (lastWithdrawalRequestTime.get(username)) {
      case (?lastTime) {
        if (now - lastTime < cooldownNs) {
          return #err(#cooldownActive);
        };
      };
      case (null) {};
    };

    // Check no pending request exists
    var hasPending = false;
    for (r in withdrawalRequests.values()) {
      if (r.username == username and r.status == #pending) {
        hasPending := true;
      };
    };
    if (hasPending) {
      return #err(#pendingRequestExists);
    };

    let requestId = nextRequestId;
    nextRequestId += 1;

    let newRequest : WithdrawalRequest = {
      id = requestId;
      username;
      amount = wallet.pendingBalance;
      upiId;
      requestedAt = now;
      status = #pending;
    };

    withdrawalRequests := [newRequest].concat(withdrawalRequests);
    lastWithdrawalRequestTime.add(username, now);

    #ok;
  };

  public shared ({ caller }) func markWithdrawalPaid(requestId : Nat) : async () {
    withdrawalRequests := withdrawalRequests.map(
      func(r : WithdrawalRequest) : WithdrawalRequest {
        if (r.id == requestId and r.status == #pending) {
          // Move amount from pendingBalance to totalWithdrawn
          switch (playerWallets.get(r.username)) {
            case (?w) {
              let paid = r.amount;
              let newPending = if (w.pendingBalance >= paid) { Nat.sub(w.pendingBalance, paid) } else { 0 };
              playerWallets.add(r.username, {
                totalEarned = w.totalEarned;
                pendingBalance = newPending;
                totalWithdrawn = w.totalWithdrawn + paid;
              });
            };
            case (null) {};
          };
          { r with status = #paid };
        } else {
          r;
        };
      }
    );
  };

  public query ({ caller }) func getWithdrawalRequests() : async [WithdrawalRequest] {
    withdrawalRequests;
  };

  public shared ({ caller }) func setMinWithdrawal(amount : Nat) : async () {
    minWithdrawalAmount := amount;
  };

  public query ({ caller }) func getMinWithdrawal() : async Nat {
    minWithdrawalAmount;
  };

  // ─── Queries ──────────────────────────────

  public query ({ caller }) func getQuizState() : async QuizStatePublic {
    sanitizeState(quizState);
  };

  public query ({ caller }) func getAdminState() : async QuizStateAdmin {
    let suspicious = suspiciousUserMap.toArray().map(func((name, _)) : Text { name });
    {
      question = quizState.question;
      correctAnswers = quizState.correctAnswers;
      timerSeconds = quizState.timerSeconds;
      startTime = quizState.startTime;
      submissions = quizState.submissions;
      winner = quizState.winner;
      status = (if (quizState.status == #live and isQuizExpired(quizState)) { #finished } else { quizState.status });
      mode = quizState.mode;
      totalActivePlayers = activePlayerMap.size();
      suspiciousUsers = suspicious;
    };
  };

  public query ({ caller }) func getAdminExtras() : async AdminExtras {
    let kicked = kickedPlayers.toArray().map(func((name, _)) : Text { name });
    let blocked = blockedPlayers.toArray().map(func((name, _)) : Text { name });
    let suspicious = suspiciousUserMap.toArray().map(func((name, _)) : Text { name });
    let referrals = playerReferrals.toArray().map(func((username, referredBy)) : PlayerReferral { { username; referredBy } });
    {
      roomCode;
      kickedPlayers = kicked;
      blockedPlayers = blocked;
      activePlayers = activePlayerMap.size();
      suspiciousUsers = suspicious;
      roundLog;
      playerReferrals = referrals;
    };
  };

  public query ({ caller }) func getRoundLog() : async [RoundLogEntry] {
    roundLog;
  };

  public query ({ caller }) func getScoreboard() : async ScoreboardData {
    let sorted = playerWins.toArray().map(
      func((name, wins)) : ScoreboardEntry {
        let streak = switch (playerStreaks.get(name)) {
          case (null) { 0 };
          case (?s) { s };
        };
        { username = name; wins; streak }
      }
    ).sort(compareScoreboardEntry);
    { scoreboard = sorted; winHistory };
  };

  public query ({ caller }) func getReferralCounts() : async [ReferralCount] {
    let counts = Map.empty<Text, Nat>();
    // Count times each name is used as inviter
    for (item in playerReferrals.values()) {
      if (item != "Direct") {
        let currentCount = switch (counts.get(item)) {
          case (null) { 0 };
          case (?c) { c };
        };
        counts.add(item, currentCount + 1);
      };
    };
    // Convert to array
    let result = counts.toArray().map(func((inviter, count)) { { inviter; count } });
    // Sort by count
    result.sort(
      func(a, b) {
        Nat.compare(b.count, a.count);
      }
    );
  };

  public query ({ caller }) func getInviterForPlayer(username : Text) : async Text {
    switch (playerReferrals.get(username)) {
      case (null) { "" };
      case (?ref) {
        if (ref == "Direct") { "" } else { ref };
      };
    };
  };

  // ─── Question bank auto round mode ───────

  public shared ({ caller }) func setAutoMode(enabled : Bool, rewardAmount : Nat, timerSeconds : Nat) : async () {
    autoModeEnabled := enabled;
    autoModeReward := rewardAmount;
    autoModeTimerSeconds := timerSeconds;
  };

  public query ({ caller }) func getAutoModeSettings() : async AutoModeSettings {
    {
      enabled = autoModeEnabled;
      rewardAmount = autoModeReward;
      timerSeconds = autoModeTimerSeconds;
    };
  };

  func getUnusedQuestion() : ?QuizQuestion {
    let bankSize = questionBank.size();
    var unusedCount = 0;
    for (q in questionBank.values()) {
      switch (usedQuestionIds.get(q.id)) {
        case (null) { unusedCount += 1 };
        case (_) {};
      };
    };

    if (unusedCount == 0) {
      usedQuestionIds.clear();
      let seed = Int.abs(Time.now()) % bankSize;
      let q = questionBank[seed];
      ?q;
    } else {
      let seed = Int.abs(Time.now()) % unusedCount;
      var found = 0;
      for (q in questionBank.values()) {
        switch (usedQuestionIds.get(q.id)) {
          case (null) {
            if (found == seed) { return ?q } else { found += 1 };
          };
          case (_) {};
        };
      };
      null;
    };
  };

  public shared ({ caller }) func triggerAutoRound() : async {
    #ok : AutoRoundResult;
    #err : Text;
  } {
    switch (getUnusedQuestion()) {
      case (?question) {
        usedQuestionIds.add(question.id, true);
        let answersArray = splitAnswers(question.correctAnswers);
        currentRoundReward := autoModeReward;
        quizState := {
          question = question.question;
          correctAnswers = answersArray;
          timerSeconds = autoModeTimerSeconds;
          startTime = Time.now();
          submissions = [];
          winner = null;
          status = #live;
          mode = question.mode;
        };
        playerRoundCoinDeducted.clear();
        #ok({
          state = sanitizeState(quizState);
          category = question.category;
          questionId = question.id;
        });
      };
      case (null) { #err("No unused questions found. Please try again.") };
    };
  };

  // ─── Reset ───────────────────────────────

  public shared ({ caller }) func resetQuiz() : async () {
    quizState := {
      question = "";
      correctAnswers = ["example answer"];
      mode = #strict;
      timerSeconds = 0;
      startTime = 0;
      submissions = [];
      winner = null;
      status = #waiting;
    };
    userLastSubmissionTime.clear();
  };

  public shared ({ caller }) func resetAll() : async () {
    quizState := {
      question = "";
      correctAnswers = ["example answer"];
      mode = #strict;
      timerSeconds = 0;
      startTime = 0;
      submissions = [];
      winner = null;
      status = #waiting;
    };
    userLastSubmissionTime.clear();
    playerWins.clear();
    playerStreaks.clear();
    winHistory := [];
    blockedPlayers.clear();
    kickedPlayers.clear();
    activePlayerMap.clear();
    playerRoundAnswerCount.clear();
    playerSubmissionTimestamps.clear();
    suspiciousUserMap.clear();
    roundLog := [];
    roomCode := makeRoomCode();
    playerReferrals.clear();
    // Reset wallet & withdrawal state
    playerWallets.clear();
    withdrawalRequests := [];
    nextRequestId := 0;
    minWithdrawalAmount := 100;
    lastWithdrawalRequestTime.clear();
    currentRoundReward := 0;
    // Reset new persistent state for quiz questions/autoplay feature.
    usedQuestionIds.clear();
    autoModeEnabled := false;
    // Reset coin system
    playerCoins.clear();
    playerRoundCoinDeducted.clear();
    lastFreeCoinsTime.clear();
    coinEntryFee := 0;
    coinWinBonus := 20;
  };
};
