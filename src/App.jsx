import { useState, useEffect } from 'react'
import Select from 'react-select'
import './App.css'


import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, collection, setDoc, doc, addDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";

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

// Updated helper function: remove "-IIITK" then convert to title case
function formatName(name) {
  if (!name) return "";
  const index = name.indexOf('-IIITK');
  const cleanName = index !== -1 ? name.substring(0, index).trim() : name;
  return toTitleCase(cleanName);
}

function App() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [vote1, setVote1] = useState('')
  const [vote2, setVote2] = useState('')
  const [coupleVotes, setCoupleVotes] = useState({})  
  
  const [userVotes, setUserVotes] = useState(0);
  const [userVotesList, setUserVotesList] = useState([]);  

  
  useEffect(() => {
    const cachedUser = localStorage.getItem('valialo_user')
    if(cachedUser) {
      setUser(JSON.parse(cachedUser))
    }
    
  }, []);

  const storeUserData = async (userData) => {
    try {
      await setDoc(doc(db, "collection", userData.displayName), {
        email: userData.email,
        name: userData.displayName
      })
    } catch (error) {
      console.error("Error storing user data: ", error);
    }
  }

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'iiitkottayam.ac.in' });
    try {
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      
      if (!signedInUser.email.endsWith("@iiitkottayam.ac.in")) {
        alert("Only @iiitkottayam.ac.in accounts are allowed.");
        await signOut(auth);
        return;
      }
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
    if(!user) return;
    try {
      await deleteDoc(doc(db, "collection", user.uid));
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('valialo_user');
      alert("Your account has been unregistered.");
    } catch (error) {
      console.error("Error unregistering: ", error);
    }
  }

  
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "collection"), snapshot => {
      const usersList = [];
      snapshot.forEach(docSnap => {
        usersList.push({ uid: docSnap.id, ...docSnap.data() });
      });
      setUsers(usersList);
    });
    return () => unsubscribe();
  }, []);

  
  useEffect(() => {
    if (!user) return;
    const unsubscribeVotes = onSnapshot(collection(db, "votes"), snapshot => {
      const votesMap = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const couple = data.couple.slice().sort();
        const key = couple.join(',');
        votesMap[key] = (votesMap[key] || 0) + 1;
      });
      setCoupleVotes(votesMap);
    });
    return () => unsubscribeVotes();
  }, [user]);

  
  useEffect(() => {
    if (!user) {
      setUserVotes(0);
      return;
    }
    const userVotesQuery = query(collection(db, "votes"), where("voter", "==", user.uid));
    const unsubscribeUserVotes = onSnapshot(userVotesQuery, snapshot => {
      setUserVotes(snapshot.size);
    });
    return () => unsubscribeUserVotes();
  }, [user]);

  
  useEffect(() => {
    if (!user) {
      setUserVotesList([]);
      return;
    }
    const userVotesQuery = query(collection(db, "votes"), where("voter", "==", user.uid));
    const unsubscribeUserVotesList = onSnapshot(userVotesQuery, snapshot => {
      const votes = [];
      snapshot.forEach(docSnap => {
        votes.push(docSnap.data());
      });
      setUserVotesList(votes);
    });
    return () => unsubscribeUserVotesList();
  }, [user]);

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if(userVotes >= 5){
      alert("You have reached the maximum of 5 votes.");
      return;
    }
    if (vote1 === vote2 || !vote1 || !vote2) {
      alert("Select two different users.");
      return;
    }
    try {
      await addDoc(collection(db, "votes"), {
        voter: user.uid,
        couple: [vote1, vote2]
      });
      alert("Vote submitted!");
      setVote1('');
      setVote2('');
    } catch (error) {
      console.error("Error submitting vote: ", error);
    }
  }

  
  const userOptions = users.map(u => ({
    value: u.uid,
    label: formatName(u.name)
  }));

  
  const hardcodedVotes = [
    { couple: ["Trump", "Elon"], count: 69 },
    { couple: ["Boban", "Molly"], count: 5 },
    { couple: ["Modi", "Meloni"], count: 3 }
  ];

  
  const sortedHardcodedVotes = [...hardcodedVotes].sort((a, b) => b.count - a.count);
  const sortedLiveVotes = Object.entries(coupleVotes).sort((a, b) => b[1] - a[1]);
  
  const userAssociatedVotes = user
    ? Object.entries(coupleVotes).filter(([key]) => key.split(',').includes(user.uid))
    : [];
  
  // New: sort the votes in descending order by count
  const sortedUserAssociatedVotes = [...userAssociatedVotes].sort((a, b) => b[1] - a[1]);

  return (
    <div className="app-container">
      <header>
        <h1>Valentine's Day Shipping</h1>
      </header>
      {/* New fixed corner buttons */}
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
            <div className="voting-container">
              <h2>Welcome, {formatName(user.displayName)}</h2>
              {/* Display current vote count */}
              <p>You have submitted {userVotes} vote{userVotes !== 1 ? 's' : ''} (max 5 allowed)</p>
              {/* New: Display all votes submitted by the user */}
              {userVotesList.length > 0 && (
                <div className="user-votes-list">
                  <h4>Your Votes:</h4>
                  <ul>
                    {userVotesList.map((vote, idx) => (
                      <li key={idx}>
                        Couple: {vote.couple.map(uid => {
                          const matchedUser = users.find(u => u.uid === uid);
                          return matchedUser ? formatName(matchedUser.name) : uid;
                        }).join(' & ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Updated: Section for votes associated with the user (ranked) */}
              {sortedUserAssociatedVotes.length > 0 && (
                <div className="your-associated-votes">
                  <h4>Votes Associated With You:</h4>
                  <ul>
                    {sortedUserAssociatedVotes.map(([key, count], index) => {
                      const [uid1, uid2] = key.split(',');
                      // Determine the other user
                      const otherUid = uid1 === user.uid ? uid2 : uid1;
                      const otherUser = users.find(u => u.uid === otherUid) || { name: otherUid };
                      return (
                        <li key={index}>
                          {index + 1}. You &amp; {formatName(otherUser.name)}: {count} vote{count > 1 ? 's' : ''}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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
            </div>
            {/* Dashboard Section with both Hardcoded and Live Votes */}
            <div className="dashboard-container">
              <h3>Example:-</h3>
                            <div className="dashboard-grid">
                {sortedHardcodedVotes.map((item, index) => (
                  <div key={`hard-${index}`} className="dashboard-card">
                    <h4>{index + 1}. {item.couple[0]} &amp; {item.couple[1]} ({item.count} vote{item.count > 1 ? 's' : ''})</h4>
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
                    const [uid1, uid2] = key.split(',');
                    const user1 = users.find(u => u.uid === uid1) || { name: uid1 };
                    const user2 = users.find(u => u.uid === uid2) || { name: uid2 };
                    return (
                      <div key={`live-${key}`} className="dashboard-card">
                        <h4>{index + 1}. {formatName(user1.name)} &amp; {formatName(user2.name)} ({count} vote{count > 1 ? 's' : ''})</h4>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>
      {/* ...existing code removed for simpler UI... */}
    </div>
  )
}

export default App
