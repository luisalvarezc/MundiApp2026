import React, { createContext, useContext, useState, useEffect } from 'react';
import { Participant, Match, Prediction, ChatMessage, AppNotification } from '../types';
import { INITIAL_MATCHES } from '../initialMatches';
import { computePointsEarned, generateId, AVATAR_COLORS } from '../utils';
import {
  isFirebaseEnabled,
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  OperationType,
  handleFirestoreError
} from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface QuinielaContextProps {
  user: Participant | null;
  firebaseUser: FirebaseUser | null;
  participants: Participant[];
  matches: Match[];
  predictions: Prediction[];
  messages: ChatMessage[];
  notifications: AppNotification[];
  loading: boolean;
  isFirebase: boolean;
  isAdminUser: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  registerUser: (nickname: string, favoriteTeam: string, avatarColor: string, groupName?: string) => Promise<void>;
  updateProfile: (nickname: string, favoriteTeam: string, avatarColor: string, groupName?: string) => Promise<void>;
  savePrediction: (matchId: string, home: number, away: number) => Promise<void>;
  updateMatchScore: (matchId: string, home: number, away: number, status: 'scheduled' | 'live' | 'finished') => Promise<void>;
  postMessage: (text: string) => Promise<void>;
  toggleTeamSubscription: (team: string) => Promise<void>;
  clearNotification: (id: string) => void;
  bootstrapFirebaseData: () => Promise<void>;
  clearAllTournamentData: () => Promise<void>;
  simulateMatchEvent: (matchId: string, eventText: string) => void;
}

const QuinielaContext = createContext<QuinielaContextProps | undefined>(undefined);

// Define some funny predefined simulated family users for Offline Mode and testing groups
const OFFLINE_FAMILY_MEMBERS: Participant[] = [];

// Prepopulated predictions for simulated family members
const OFFLINE_MOCK_PREDICTIONS: Prediction[] = [];

export const QuinielaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);

  const isOnline = isFirebaseEnabled && !isOfflineFallback;

  // Check if current user is Admin (identified by request email or local fallback as admin)
  const isAdminUser = user
    ? user.email === 'luisalvarezc@gmail.com' || user.id === 'local-admin-id'
    : false;

  // --------------------------------------------------------
  // 1. OFFLINE LOCAL STORAGE INITIALIZATION / HANDLERS
  // --------------------------------------------------------
  const loadLocalStorageData = () => {
    // Matches
    const savedMatches = localStorage.getItem('quiniela_matches');
    if (savedMatches) {
      setMatches(JSON.parse(savedMatches));
    } else {
      setMatches(INITIAL_MATCHES);
      localStorage.setItem('quiniela_matches', JSON.stringify(INITIAL_MATCHES));
    }

    // Participants (Simulated + Local user profile)
    const savedParticipants = localStorage.getItem('quiniela_participants');
    if (savedParticipants) {
      setParticipants(JSON.parse(savedParticipants));
    } else {
      setParticipants(OFFLINE_FAMILY_MEMBERS);
      localStorage.setItem('quiniela_participants', JSON.stringify(OFFLINE_FAMILY_MEMBERS));
    }

    // Predictions
    const savedPredictions = localStorage.getItem('quiniela_predictions');
    if (savedPredictions) {
      setPredictions(JSON.parse(savedPredictions));
    } else {
      setPredictions(OFFLINE_MOCK_PREDICTIONS);
      localStorage.setItem('quiniela_predictions', JSON.stringify(OFFLINE_MOCK_PREDICTIONS));
    }

    // Local profile
    const savedLocalUser = localStorage.getItem('quiniela_local_user');
    if (savedLocalUser) {
      const parsedUser = JSON.parse(savedLocalUser);
      setUser(parsedUser);
      // Auto register current user email if matches the prompt admin
      if (parsedUser.email === 'luisalvarezc@gmail.com') {
        parsedUser.id = 'local-admin-id';
      }
    }

    // Chat messages
    const savedMessages = localStorage.getItem('quiniela_messages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      const initialMsgs: ChatMessage[] = [];
      setMessages(initialMsgs);
      localStorage.setItem('quiniela_messages', JSON.stringify(initialMsgs));
    }

    // Notifications
    const savedNotifs = localStorage.getItem('quiniela_notifications');
    if (savedNotifs) {
      setNotifications(JSON.parse(savedNotifs));
    }

    setLoading(false);
  };

  // --------------------------------------------------------
  // 2. FIREBASE REAL-TIME SYNC ENGINE
  // --------------------------------------------------------
  useEffect(() => {
    if (isOfflineFallback) {
      loadLocalStorageData();
      return;
    }

    if (!isFirebaseEnabled || !auth || !db) {
      loadLocalStorageData();
      return;
    }

    console.log("Setting up Firebase event listeners...");
    setLoading(true);

    let active = true;

    const triggerOfflineFallback = (err: any) => {
      if (!active) return;
      console.warn("Firestore offline detected. Switching to offline mode gracefully.", err);
      setIsOfflineFallback(true);
    };

    // Watch Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Fetch or create user profile in Firestore
        const userRef = doc(db, 'users', fUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as Participant;
            if (!userData.groupName) {
              userData.groupName = "Familia";
            }
            setUser(userData);
          } else {
            // User exists in auth but not yet registered with profile fields in users collection
            setUser(null);
          }
        } catch (err) {
          if (err instanceof Error && (
            err.message.includes('offline') || 
            err.message.includes('client is offline') ||
            err.message.includes('network') ||
            err.message.includes('unavailable')
          )) {
            triggerOfflineFallback(err);
          } else {
            handleFirestoreError(err, OperationType.GET, `users/${fUser.uid}`);
          }
        }
      } else {
        setUser(null);
      }
    });

    // Listen to matches real-time
    const unsubscribeMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const matchesList: Match[] = [];
      snapshot.forEach((doc) => {
        matchesList.push(doc.data() as Match);
      });
      // Sort matches by time
      matchesList.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      
      // If Firestore database is brand new and completely empty, set matches to original set
      if (matchesList.length === 0) {
        setMatches(INITIAL_MATCHES);
      } else {
        setMatches(matchesList);
      }
    }, (error) => {
      if (error instanceof Error && (
        error.message.includes('offline') || 
        error.message.includes('client is offline') ||
        error.message.includes('network') ||
        error.message.includes('unavailable')
      )) {
        triggerOfflineFallback(error);
      } else {
        handleFirestoreError(error, OperationType.GET, 'matches');
      }
    });

    // Listen to users (standings leaderboard)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: Participant[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data() as Participant;
        if (!u.groupName) {
          u.groupName = "Familia";
        }
        usersList.push(u);
      });
      // Sort by points, then hits
      usersList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
        return b.outcomeHits - a.outcomeHits;
      });
      setParticipants(usersList);
    }, (error) => {
      if (error instanceof Error && (
        error.message.includes('offline') || 
        error.message.includes('client is offline') ||
        error.message.includes('network') ||
        error.message.includes('unavailable')
      )) {
        triggerOfflineFallback(error);
      } else {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    });

    // Listen to messages (chat)
    const unsubscribeMessages = onSnapshot(
      query(collection(db, 'messages'), orderBy('timestamp', 'asc')),
      (snapshot) => {
        const msgsList: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          msgsList.push(doc.data() as ChatMessage);
        });
        setMessages(msgsList);
      }, (error) => {
        if (error instanceof Error && (
          error.message.includes('offline') || 
          error.message.includes('client is offline') ||
          error.message.includes('network') ||
          error.message.includes('unavailable')
        )) {
          triggerOfflineFallback(error);
        } else {
          handleFirestoreError(error, OperationType.GET, 'messages');
        }
      }
    );

    // Listen to predictions
    const unsubscribePredictions = onSnapshot(collection(db, 'predictions'), (snapshot) => {
      const predList: Prediction[] = [];
      snapshot.forEach((doc) => {
        predList.push(doc.data() as Prediction);
      });
      setPredictions(predList);
      setLoading(false);
    }, (error) => {
      if (error instanceof Error && (
        error.message.includes('offline') || 
        error.message.includes('client is offline') ||
        error.message.includes('network') ||
        error.message.includes('unavailable')
      )) {
        triggerOfflineFallback(error);
      } else {
        handleFirestoreError(error, OperationType.GET, 'predictions');
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeMatches();
      unsubscribeUsers();
      unsubscribeMessages();
      unsubscribePredictions();
    };
  }, [isOfflineFallback]);

  // Recalculates points locally or online when actual match score updates
  const calculatePointsStandings = (allMatches: Match[], allPreds: Prediction[], allParticipants: Participant[]) => {
    // 1. Calculate prediction points
    const updatedPredictions = allPreds.map(pred => {
      const match = allMatches.find(m => m.id === pred.matchId);
      if (match && match.homeScore !== -1 && match.awayScore !== -1) {
        const calc = computePointsEarned(pred.homePredict, pred.awayPredict, match.homeScore, match.awayScore);
        return {
          ...pred,
          pointsEarned: calc.points,
          calculated: true
        };
      }
      return { ...pred, pointsEarned: 0, calculated: false };
    });

    // 2. Roll up points and hits per participant
    const updatedParticipants = allParticipants.map(participant => {
      let totalPoints = 0;
      let exactHits = 0;
      let outcomeHits = 0;

      updatedPredictions.forEach(pred => {
        if (pred.userId === participant.id && pred.calculated) {
          totalPoints += pred.pointsEarned;
          if (pred.pointsEarned === 5) {
            exactHits += 1;
          } else if (pred.pointsEarned === 3 || pred.pointsEarned === 1) {
            outcomeHits += 1;
          }
        }
      });

      return {
        ...participant,
        points: totalPoints,
        exactHits,
        outcomeHits
      };
    });

    // Sort updated participants by points, then hits
    updatedParticipants.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      return b.outcomeHits - a.outcomeHits;
    });

    return { updatedPredictions, updatedParticipants };
  };

  // --------------------------------------------------------
  // 3. CORE ACTIONS IMPLEMENTATION
  // --------------------------------------------------------

  // LOGIN / REGISTER ACTIONS
  const loginWithGoogle = async () => {
    if (!isOnline || !auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Auth Popup Failed:", err);
    }
  };

  const logout = async () => {
    if (isOnline && auth) {
      await signOut(auth);
      setFirebaseUser(null);
      setUser(null);
    } else {
      setUser(null);
      localStorage.removeItem('quiniela_local_user');
    }
  };

  const registerUser = async (nickname: string, favoriteTeam: string, avatarColor: string, groupName: string = "Familia") => {
    if (isOnline && db && firebaseUser) {
      const isDevAdmin = firebaseUser.email === 'luisalvarezc@gmail.com';
      const newUser: Participant = {
        id: firebaseUser.uid,
        nickname,
        email: firebaseUser.email || '',
        favoriteTeam,
        avatarColor,
        points: 0,
        exactHits: 0,
        outcomeHits: 0,
        subscribedTeams: [favoriteTeam],
        groupName: groupName
      };

      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        setUser(newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
      }
    } else {
      // Offline implementation
      const emailPlaceholder = nickname.toLowerCase().replace(/\s/g, '') + '@familiar.com';
      const isPromptAdmin = emailPlaceholder === 'luisalvarezc@gmail.com' || nickname.toLowerCase().includes('luis');
      const fallbackId = isPromptAdmin ? 'local-admin-id' : 'local-user-' + generateId();
      
      const newLocalUser: Participant = {
        id: fallbackId,
        nickname,
        email: isPromptAdmin ? 'luisalvarezc@gmail.com' : emailPlaceholder,
        favoriteTeam,
        avatarColor,
        points: 0,
        exactHits: 0,
        outcomeHits: 0,
        isLocallyCreated: true,
        subscribedTeams: [favoriteTeam],
        groupName: groupName
      };

      setUser(newLocalUser);
      localStorage.setItem('quiniela_local_user', JSON.stringify(newLocalUser));

      // Append user to participants list if doesn't exist
      const updatedParticipants = [...participants.filter(p => p.id !== fallbackId), newLocalUser];
      setParticipants(updatedParticipants);
      localStorage.setItem('quiniela_participants', JSON.stringify(updatedParticipants));
    }
  };

  const updateProfile = async (nickname: string, favoriteTeam: string, avatarColor: string, groupName: string = "Familia") => {
    if (!user) return;
    const updated = {
      ...user,
      nickname,
      favoriteTeam,
      avatarColor,
      groupName
    };

    if (isOnline && db && firebaseUser) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          nickname,
          favoriteTeam,
          avatarColor,
          groupName
        });
        setUser(updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
    } else {
      setUser(updated);
      localStorage.setItem('quiniela_local_user', JSON.stringify(updated));

      const updatedParticipants = participants.map(p => p.id === user.id ? { ...p, nickname, favoriteTeam, avatarColor, groupName } : p);
      setParticipants(updatedParticipants);
      localStorage.setItem('quiniela_participants', JSON.stringify(updatedParticipants));
    }
  };

  // PREDICTION STORAGE ACTS
  const savePrediction = async (matchId: string, home: number, away: number) => {
    if (!user) return;

    // Check lock state (15 minutes before)
    const targetMatch = matches.find(m => m.id === matchId);
    if (targetMatch) {
      if (targetMatch.status === 'live' || targetMatch.status === 'finished') {
        throw new Error("El partido ya ha comenzado u Oficialmente finalizado.");
      }
      const kickoff = new Date(targetMatch.dateTime).getTime();
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() >= (kickoff - fifteenMinutes)) {
        throw new Error("Las predicciones están bloqueadas de forma automática 15 minutos antes del partido.");
      }
    }

    const predictionId = `${user.id}_${matchId}`;

    const newPred: Prediction = {
      id: predictionId,
      userId: user.id,
      matchId,
      homePredict: home,
      awayPredict: away,
      pointsEarned: 0,
      calculated: false
    };

    if (isOnline && db) {
      try {
        await setDoc(doc(db, 'predictions', predictionId), newPred);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `predictions/${predictionId}`);
      }
    } else {
      // Offline prediction map
      const updatedPreds = [...predictions.filter(p => p.id !== predictionId), newPred];
      
      // Calculate standings in-place offline whenever predictive scoring records are processed
      const { updatedPredictions, updatedParticipants } = calculatePointsStandings(matches, updatedPreds, participants);
      
      setPredictions(updatedPredictions);
      localStorage.setItem('quiniela_predictions', JSON.stringify(updatedPredictions));

      setParticipants(updatedParticipants);
      localStorage.setItem('quiniela_participants', JSON.stringify(updatedParticipants));

      // Update local user's own live rolled-up score points
      const updatedMe = updatedParticipants.find(p => p.id === user.id);
      if (updatedMe) {
        setUser(updatedMe);
        localStorage.setItem('quiniela_local_user', JSON.stringify(updatedMe));
      }
    }
  };

  // ADMIN ACTION: UPDATING SCORE OF MATCH
  const updateMatchScore = async (matchId: string, home: number, away: number, status: 'scheduled' | 'live' | 'finished') => {
    if (!isAdminUser) return;

    if (isOnline && db) {
      try {
        // Fetch specific match info first
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, {
          homeScore: home,
          awayScore: away,
          status: status
        });

        // Query all predictions to recalculate
        // In fully online Firestore, calculation is triggered and batches can resolve it,
        // or we can recalculate inside the transaction / client-write triggers.
        // Let's implement live sync recalculation on the admin clients side by writing back modified users points.
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const matchesList: Match[] = [];
        matchesSnap.forEach(d => matchesList.push(d.data() as Match));
        
        // Update the current match in state reference to perform points mapping
        const targetIdx = matchesList.findIndex(m => m.id === matchId);
        if (targetIdx !== -1) {
          matchesList[targetIdx] = { ...matchesList[targetIdx], homeScore: home, awayScore: away, status };
        }

        const predsSnap = await getDocs(collection(db, 'predictions'));
        const predsList: Prediction[] = [];
        predsSnap.forEach(d => predsList.push(d.data() as Prediction));

        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList: Participant[] = [];
        usersSnap.forEach(d => usersList.push(d.data() as Participant));

        const { updatedPredictions, updatedParticipants } = calculatePointsStandings(matchesList, predsList, usersList);

        // write back updated calculations to Firestore in batch
        const batch = writeBatch(db);
        
        // Write back predictions calculations
        updatedPredictions.forEach(up => {
          if (up.calculated) {
            batch.set(doc(db, 'predictions', up.id), up);
          }
        });

        // Write back rollups
        updatedParticipants.forEach(upParticipant => {
          batch.set(doc(db, 'users', upParticipant.id), upParticipant);
        });

        await batch.commit();

        // Trigger goal simulation toast if live and home/away changes
        triggerGoalNotification(matchId, home, away, status);

      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
      }
    } else {
      // Offline Admin calculation
      const updatedMatches = matches.map(m => m.id === matchId ? { ...m, homeScore: home, awayScore: away, status } : m);
      setMatches(updatedMatches);
      localStorage.setItem('quiniela_matches', JSON.stringify(updatedMatches));

      const { updatedPredictions, updatedParticipants } = calculatePointsStandings(updatedMatches, predictions, participants);

      setPredictions(updatedPredictions);
      localStorage.setItem('quiniela_predictions', JSON.stringify(updatedPredictions));

      setParticipants(updatedParticipants);
      localStorage.setItem('quiniela_participants', JSON.stringify(updatedParticipants));

      if (user) {
        const updatedMe = updatedParticipants.find(p => p.id === user.id);
        if (updatedMe) {
          setUser(updatedMe);
          localStorage.setItem('quiniela_local_user', JSON.stringify(updatedMe));
        }
      }

      // Also generate local notification for simulated events
      triggerGoalNotification(matchId, home, away, status);
    }
  };

  // Helper to trigger goal in-app push simulator notification toasts
  const triggerGoalNotification = (matchId: string, home: number, away: number, status: 'scheduled' | 'live' | 'finished') => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    let textStr = '';
    let notificationType: 'goal' | 'system' | 'lock' = 'goal';

    if (status === 'live') {
      textStr = `⚽ ¡GOOOL en el partido! ${match.homeTeam} ${home} - ${away} ${match.awayTeam}. El partido está EN VIVO.`;
    } else if (status === 'finished') {
      textStr = `🏁 ¡Partido Finalizado! Resultado Oficial: ${match.homeTeam} ${home} - ${away} ${match.awayTeam}. Mira la Tabla de Clasificación.`;
      notificationType = 'system';
    }

    if (textStr) {
      const newNotif: AppNotification = {
        id: 'notif-' + generateId(),
        text: textStr,
        timestamp: new Date().toISOString(),
        isRead: false,
        matchId,
        type: notificationType
      };

      const updatedNotifs = [newNotif, ...notifications].slice(0, 15); // limit to 15 alerts
      setNotifications(updatedNotifs);
      localStorage.setItem('quiniela_notifications', JSON.stringify(updatedNotifs));
    }
  };

  // Helper to trigger custom simulated live commentary/push alerts (e.g. goal scored by a team followed)
  const simulateMatchEvent = (matchId: string, eventText: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Verify if user follows either of these teams
    const homeFollowed = user?.subscribedTeams.includes(match.homeTeam);
    const awayFollowed = user?.subscribedTeams.includes(match.awayTeam);

    if (homeFollowed || awayFollowed) {
      const isGoal = eventText.toLowerCase().includes('gol');
      const newNotif: AppNotification = {
        id: 'notif-' + generateId(),
        text: `📢 ALERTA EQUIPO SEGUIDO: ${eventText}`,
        timestamp: new Date().toISOString(),
        isRead: false,
        matchId,
        type: isGoal ? 'goal' : 'system'
      };

      setNotifications(prev => {
        const updated = [newNotif, ...prev].slice(0, 15);
        localStorage.setItem('quiniela_notifications', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // CHAT COMMUNICATION POSTS
  const postMessage = async (text: string) => {
    if (!user) return;

    const newMsg: ChatMessage = {
      id: 'msg-' + generateId(),
      userId: user.id,
      nickname: user.nickname,
      avatarColor: user.avatarColor,
      text: text,
      timestamp: new Date().toISOString()
    };

    if (isOnline && db) {
      try {
        await setDoc(doc(db, 'messages', newMsg.id), newMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `messages/${newMsg.id}`);
      }
    } else {
      const updatedMsgs = [...messages, newMsg];
      setMessages(updatedMsgs);
      localStorage.setItem('quiniela_messages', JSON.stringify(updatedMsgs));
    }
  };

  // FOLLOW/SUBSCRIBE TEAMS FOR CUSTOM PUSH SIMULATION CHANNELS
  const toggleTeamSubscription = async (team: string) => {
    if (!user) return;
    const isSubscribed = user.subscribedTeams?.includes(team) || false;
    let updatedSubscribed = user.subscribedTeams || [];

    if (isSubscribed) {
      updatedSubscribed = updatedSubscribed.filter(t => t !== team);
    } else {
      updatedSubscribed = [...updatedSubscribed, team];
    }

    const updatedUser = {
      ...user,
      subscribedTeams: updatedSubscribed
    };

    if (isOnline && db && firebaseUser) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          subscribedTeams: updatedSubscribed
        });
        setUser(updatedUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
      }
    } else {
      setUser(updatedUser);
      localStorage.setItem('quiniela_local_user', JSON.stringify(updatedUser));

      const updatedParticipants = participants.map(p => p.id === user.id ? { ...p, subscribedTeams: updatedSubscribed } : p);
      setParticipants(updatedParticipants);
      localStorage.setItem('quiniela_participants', JSON.stringify(updatedParticipants));
    }
  };

  const clearNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('quiniela_notifications', JSON.stringify(updated));
  };

  // ADMIN ACTION: BOOTSTRAP FIREBASE & LOCAL STATE WITH THE FULL WORLD CUP SCHEDULE
  const bootstrapFirebaseData = async () => {
    if (!isAdminUser) return;
    console.log("Admin triggers match DB initialization...");

    // Reset local state & localStorage to the full initial 104 matches
    setMatches(INITIAL_MATCHES);
    localStorage.setItem('quiniela_matches', JSON.stringify(INITIAL_MATCHES));

    // Clear stale notifications
    setNotifications([]);
    localStorage.removeItem('quiniela_notifications');

    if (isOnline && db) {
      try {
        console.log("Writing 104 matches to Firestore database...");
        for (const m of INITIAL_MATCHES) {
          await setDoc(doc(db, 'matches', m.id), m);
        }
        console.log("Firestore Match DB initialized successfully with 104 games.");
      } catch (err) {
        console.error("Firebase DB Bootstrapping Error:", err);
        handleFirestoreError(err, OperationType.WRITE, 'matches/bootstrap');
      }
    }
  };

  // ADMIN ACTION: RESET DATABASE AND CLEAR FAMILY/TEST RECORDS ENTIRELY
  const clearAllTournamentData = async () => {
    if (!isAdminUser) return;
    console.log("Admin triggers tournament system purge...");

    // 1. Reset local state and local storage caches completely
    localStorage.removeItem('quiniela_participants');
    localStorage.removeItem('quiniela_predictions');
    localStorage.removeItem('quiniela_messages');
    localStorage.removeItem('quiniela_notifications');

    setPredictions([]);
    setMessages([]);
    setNotifications([]);

    if (isOnline && db) {
      try {
        // Clear predictions collection
        const predsSnap = await getDocs(collection(db, 'predictions'));
        for (const pd of predsSnap.docs) {
          await deleteDoc(doc(db, 'predictions', pd.id));
        }

        // Clear messages (chat) collection
        const msgsSnap = await getDocs(collection(db, 'messages'));
        for (const msg of msgsSnap.docs) {
          await deleteDoc(doc(db, 'messages', msg.id));
        }

        // Clear users (participants) collection EXCEPT the admin itself
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const uDoc of usersSnap.docs) {
          const uId = uDoc.id;
          const uEmail = uDoc.get('email');
          // Keep the admin user or current user account so they aren't kicked out
          const keepUser = (firebaseUser && uId === firebaseUser.uid) || uEmail === 'luisalvarezc@gmail.com';
          if (!keepUser) {
            await deleteDoc(doc(db, 'users', uId));
          } else {
            // Reset Admin score stats to zero
            await updateDoc(doc(db, 'users', uId), {
              points: 0,
              exactHits: 0,
              outcomeHits: 0
            });
          }
        }

        // Reset matches scores to null and 'scheduled' status
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const batch = writeBatch(db);
        for (const mDoc of matchesSnap.docs) {
          const mRef = doc(db, 'matches', mDoc.id);
          batch.update(mRef, {
            homeScore: null,
            awayScore: null,
            status: 'scheduled'
          });
        }
        await batch.commit();

        console.log("Online DB successfully purged and reset.");
      } catch (err) {
        console.error("Purging Firestore Error:", err);
        handleFirestoreError(err, OperationType.DELETE, 'stale-data-purge');
      }
    } else {
      // Local clean
      const clearedMe = user ? { ...user, points: 0, exactHits: 0, outcomeHits: 0 } : null;
      setParticipants(clearedMe ? [clearedMe] : []);
      localStorage.setItem('quiniela_participants', JSON.stringify(clearedMe ? [clearedMe] : []));
      
      const resetMatches = matches.map(m => ({ ...m, homeScore: null, awayScore: null, status: 'scheduled' as const }));
      setMatches(resetMatches);
      localStorage.setItem('quiniela_matches', JSON.stringify(resetMatches));
      
      if (clearedMe) {
        setUser(clearedMe);
        localStorage.setItem('quiniela_local_user', JSON.stringify(clearedMe));
      }
    }
  };

  return (
    <QuinielaContext.Provider value={{
      user,
      firebaseUser,
      participants,
      matches,
      predictions,
      messages,
      notifications,
      loading,
      isFirebase: isOnline,
      isAdminUser,
      loginWithGoogle,
      logout,
      registerUser,
      updateProfile,
      savePrediction,
      updateMatchScore,
      postMessage,
      toggleTeamSubscription,
      clearNotification,
      bootstrapFirebaseData,
      clearAllTournamentData,
      simulateMatchEvent
    }}>
      {children}
    </QuinielaContext.Provider>
  );
};

export const useQuiniela = () => {
  const context = useContext(QuinielaContext);
  if (!context) {
    throw new Error('useQuiniela must be used within a QuinielaProvider');
  }
  return context;
};
