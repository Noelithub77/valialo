import { useState, useEffect } from 'react'
import Select from 'react-select'
import './App.css'
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signOut 
} from "firebase/auth";
import { 
  getFirestore, collection, setDoc, doc, addDoc, deleteDoc, onSnapshot, query, where, runTransaction 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB3r-pauIsKxh1ZBFaMwqStQWHIiWUZD3o",
  authDomain: "valialo.firebaseapp.com",
  projectId: "valialo",
  storageBucket: "valialo.firebasestorage.app",
  messagingSenderId: "244028649653",
  appId: "1:244028649653:web:2cf82ef52ca7cea4770efc",
  measurementId: "G-KGFK7Z4HB6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const customStyles = {
  control: (provided) => ({
    ...provided,
    backgroundColor: 'white',
    color: 'black'
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'black'
  }),
  input: (provided) => ({
    ...provided,
    color: 'black'
  }),
  option: (provided, state) => ({
    ...provided,
    color: state.isSelected ? 'white' : 'black',
    backgroundColor: state.isSelected ? '#2684FF' : 'white',
    ':hover': {
      backgroundColor: '#eee'
    }
  })
};

// New: helper to convert string to title case
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatName(name) {
  if (!name) return "";
  const index = name.indexOf('-IIITK');
  const cleanName = index !== -1 ? name.substring(0, index).trim() : name;
  return toTitleCase(cleanName);
}

// Remove unused state: userVotes and userVotesList
function App() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [vote1, setVote1] = useState('')
  const [vote2, setVote2] = useState('')
  const [coupleVotes, setCoupleVotes] = useState({})
  // Removed: userVotes and userVotesList

  const reportUrl = "https://wa.me/918848896274";
  const [phase, setPhase] = useState("all");

  // New: Listen to /setting/round Firebase doc
  useEffect(() => {
    const phaseDocRef = doc(db, "setting", "round");
    const unsubscribePhase = onSnapshot(phaseDocRef, snapshot => {
      const data = snapshot.data();
      if (data && data.phase) {
        setPhase(data.phase);
      }
    });
    return () => unsubscribePhase();
  }, [db]);

  // New phase flags
  const isRegistration = phase === "registration";
  const isVoting = phase === "voting";
  const isResult = phase === "result";
  const isAll = phase === "all";

  useEffect(() => {
    const cachedUser = localStorage.getItem('valialo_user')
    if(cachedUser) {
      setUser(JSON.parse(cachedUser))
    }
    
  }, []);

  const storeUserData = async (userData) => {
    try {
      const cleanedName = formatName(userData.displayName);
      await setDoc(doc(db, "users", cleanedName), {  // changed collection and document id
        email: userData.email,
        name: cleanedName
      });
    } catch (error) {
      console.error("Error storing user data: ", error);
    }
  }

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    // provider.setCustomParameters({ hd: 'iiitkottayam.ac.in' });
    try {
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      
      // if (!signedInUser.email.endsWith("@iiitkottayam.ac.in")) {
      //   alert("Only @iiitkottayam.ac.in accounts are allowed.");
      //   await signOut(auth);
      //   return;
      // }
      setUser(signedInUser);
      localStorage.setItem('valialo_user', JSON.stringify(signedInUser)); 
      storeUserData(signedInUser);
    } catch (error) {
      console.error("Error during sign in: ", error);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('valialo_user');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  }

  const handleUnregister = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", formatName(user.displayName))); // updated collection and document id
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('valialo_user');
      alert("Your account has been unregistered.");
    } catch (error) {
      console.error("Error unregistering: ", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), snapshot => { // updated to listen to "users"
      const usersList = [];
      snapshot.forEach(docSnap => {
        usersList.push({ uid: docSnap.id, ...docSnap.data() }); 
      });
      setUsers(usersList);
    });
    return () => unsubscribe();
  }, []);

  // Update: votes snapshot effect now reads aggregated count from each doc
  useEffect(() => {
    const unsubscribeVotes = onSnapshot(collection(db, "votes"), snapshot => {
      const votesMap = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const couple = data.couple.slice().sort();
        const key = couple.join(',');
        votesMap[key] = data.count;
      });
      setCoupleVotes(votesMap);
    });
    return () => unsubscribeVotes();
  }, []);

  // Remove userVotes and userVotesList related useEffects

  // Update vote submit handler to use aggregated vote doc
  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (vote1 === vote2 || !vote1 || !vote2) {
      alert("Select two different users.");
      return;
    }
    const firstUser = users.find(u => u.uid === vote1);
    const secondUser = users.find(u => u.uid === vote2);
    if (!firstUser || !secondUser) {
      alert("Invalid vote selection.");
      return;
    }
    const cleanedCouple = [formatName(firstUser.name), formatName(secondUser.name)].sort();
    const docId = cleanedCouple.join(',');
    try {
      await runTransaction(db, async (transaction) => {
        const voteDocRef = doc(db, "votes", docId);
        const voteDoc = await transaction.get(voteDocRef);
        if (!voteDoc.exists()) {
          transaction.set(voteDocRef, { couple: cleanedCouple, count: 1 });
        } else {
          transaction.update(voteDocRef, { count: voteDoc.data().count + 1 });
        }
      });
      alert("Vote submitted!");
      setVote1('');
      setVote2('');
    } catch (error) {
      console.error("Error submitting vote: ", error);
    }
  }

  // Build userOptions from "users" collection remains unchanged
  const userOptions = users.map(u => ({
    value: u.uid,
    label: formatName(u.name)
  }));

  const hardcodedVotes = [
    { couple: ["Modi", "Meloni"], count: 69 },
    { couple: ["Trump", "Elon"], count: 7 },
    { couple: ["Tom", "Zendaya"], count: 5 }
  ];

  const sortedHardcodedVotes = [...hardcodedVotes].sort((a, b) => b.count - a.count);
  const sortedLiveVotes = Object.entries(coupleVotes).sort((a, b) => b[1] - a[1]);

  const userCleanedName = user ? formatName(user.displayName) : "";
  // Update: filter aggregated votes by checking if the couple array (doc id) includes the user's cleaned name.
  const userAssociatedVotes = user
    ? Object.entries(coupleVotes).filter(([key]) => key.split(',').includes(userCleanedName))
    : [];
  const sortedUserAssociatedVotes = [...userAssociatedVotes].sort((a, b) => b[1] - a[1]);

  return (
    <div className="app-container">
      <header>
        <h1>Valentine's Day Shipping</h1>
      </header>
      {user && (
        <>
          <div className="corner-actions-left">
            <button onClick={handleUnregister}>Unregister</button>
          </div>
          <div className="corner-actions-right">
            <button onClick={handleLogout}>Logout</button>
          </div>
        </>
      )}
      <main>
        {!user ? (
          <div className="signin-container">
            <p>Sign in with Google to start shipping the perfect couple!  By signing up, you acknowledge that your name will be added to the list. This endeavor is purely for enjoyment, and we encourage you to register only if you are ready to face the consequences.</p>
            <button onClick={handleGoogleSignIn}>Sign in with Google</button>
          </div>
        ) : (
          <>
            {(isVoting || isAll) && (
              <div className="voting-container">
                <h2>Welcome, {formatName(user.displayName)}</h2>
                <p>Choose two people to ship as a couple:</p>
                <form onSubmit={handleVoteSubmit}>
                  <div className="dropdown-group">
                    <label>Select first user:</label>
                    <Select
                      options={userOptions}
                      value={userOptions.find(opt => opt.value === vote1)}
                      onChange={(option) => setVote1(option ? option.value : '')}
                      placeholder="Select first user..."
                      isClearable
                      styles={customStyles} 
                    />
                  </div>
                  <div className="dropdown-group">
                    <label>Select second user:</label>
                    <Select
                      options={userOptions}
                      value={userOptions.find(opt => opt.value === vote2)}
                      onChange={(option) => setVote2(option ? option.value : '')}
                      placeholder="Select second user..."
                      isClearable
                      styles={customStyles} 
                    />
                  </div>
                  <button type="submit">Ship'em!</button>
                </form>
                {sortedUserAssociatedVotes.length > 0 && (
                  <div className="your-associated-votes">
                    <div className="your-associated-votes-header">
                      <h4>Votes Associated With You:</h4>
                      <button 
                        className="report-button" 
                        onClick={() => window.open(reportUrl, '_blank')}>
                        ⚠️ Report
                      </button>
                    </div>
                    <ul>
                      {sortedUserAssociatedVotes.map(([key, count], index) => {
                        const [name1, name2] = key.split(',');
                        const otherName = name1 === userCleanedName ? name2 : name1;
                        return (
                          <li key={index}>
                            {index + 1}) You &amp; {otherName}: {count} vote{count > 1 ? 's' : ''}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {(isRegistration || isResult || isAll) && (
              <div className="dashboard-container">
                {isRegistration ? (
                  <>
                    <p>
                      Registration Phase: Get your friends registered too!!. <br></br>
                      The voting would start shortly, you are allowed up to 5 votes.
                    </p>
                    <h3>Example:</h3>
                    <div className="dashboard-grid">
                      {sortedHardcodedVotes.map((item, index) => (
                        <div key={`hard-${index}`} className="dashboard-card">
                          <h4>
                            {index + 1}. {item.couple[0]} &amp; {item.couple[1]} ({item.count} vote{item.count > 1 ? 's' : ''})
                          </h4>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Example:</h3>
                    <div className="dashboard-grid">
                      {sortedHardcodedVotes.map((item, index) => (
                        <div key={`hard-${index}`} className="dashboard-card">
                          <h4>
                            {index + 1}. {item.couple[0]} &amp; {item.couple[1]} ({item.count} vote{item.count > 1 ? 's' : ''})
                          </h4>
                        </div>
                      ))}
                    </div>
                    <hr />
                    <h4>Live Votes</h4>
                    <div className="dashboard-grid">
                      {sortedLiveVotes.length === 0 ? (
                        <p>No live votes yet.</p>
                      ) : (
                        sortedLiveVotes.map(([key, count], index) => {
                          const [name1, name2] = key.split(',');
                          return (
                            <div key={`live-${key}`} className="dashboard-card">
                              <h4>
                                {index + 1}. {name1} &amp; {name2} ({count} vote{count > 1 ? 's' : ''})
                              </h4>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
      {/* ...existing code... */}
    </div>
  )
}

export default App
