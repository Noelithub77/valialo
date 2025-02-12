import { useState, useEffect } from 'react'
import Select from 'react-select'
import './App.css'

// Firebase imports remain unchanged...
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore, collection, setDoc, doc, getDocs, addDoc, deleteDoc } from "firebase/firestore";

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

// New: custom styles for react-select
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

function App() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [vote1, setVote1] = useState('')
  const [vote2, setVote2] = useState('')
  const [coupleVotes, setCoupleVotes] = useState({})  // New state for votes overview

  // On load, restore cached user if available
  useEffect(() => {
    const cachedUser = localStorage.getItem('valialo_user')
    if(cachedUser) {
      setUser(JSON.parse(cachedUser))
    }
    // Fetch users regardless of cached login.
    fetchUsers();
    if(user) {
      fetchVotes();
    }
    // eslint-disable-next-line
  }, []);

  const storeUserData = async (userData) => {
    try {
      await setDoc(doc(db, "collection", userData.uid), {
        email: userData.email,
        name: userData.displayName
      })
      fetchUsers()
    } catch (error) {
      console.error("Error storing user data: ", error);
    }
  }

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      setUser(signedInUser);
      localStorage.setItem('valialo_user', JSON.stringify(signedInUser)) // cache login
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

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "collection"));
      const usersList = [];
      querySnapshot.forEach(docSnap => {
        usersList.push({ uid: docSnap.id, ...docSnap.data() });
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users: ", error);
    }
  }
  
  // New: fetch votes and group by sorted couple key
  const fetchVotes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "votes"));
      const votesMap = {};
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const couple = data.couple.slice().sort();
        const key = couple.join(',');
        votesMap[key] = (votesMap[key] || 0) + 1;
      });
      setCoupleVotes(votesMap);
    } catch (error) {
      console.error("Error fetching votes: ", error);
    }
  }

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
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
      fetchVotes(); // Refresh votes after submission
    } catch (error) {
      console.error("Error submitting vote: ", error);
    }
  }

  useEffect(() => {
    fetchUsers();
    if(user) {
      fetchVotes();
    }
  }, [user]);

  // Map users to react-select options.
  const userOptions = users.map(u => ({
    value: u.uid,
    label: `${u.name} (${u.email})`
  }));

  // Hardcoded dashboard data remains.
  const hardcodedVotes = [
    { couple: ["Trump", "Elon"], count: 69 },
    { couple: ["Boban", "Molly"], count: 5 },
    { couple: ["Tom", "Zendaya"], count: 3 }
  ];

  return (
    <div className="app-container">
      <header>
        <h1>Valentine's Day Shipping</h1>
      </header>
      <main>
        {!user ? (
          <div className="signin-container">
            <p>Sign in with Google to start shipping the perfect couple!  By signing up, you acknowledge that your name will be added to the list. This endeavor is purely for enjoyment, and we encourage you to register only if you are ready to face the consequences.</p>
            <button onClick={handleGoogleSignIn}>Sign in with Google</button>
          </div>
        ) : (
          <>
            <div className="voting-container">
              <h2>Welcome, {user.displayName}</h2>
              <div className="user-actions">
                <button onClick={handleLogout}>Logout</button>
                <button onClick={handleUnregister}>Unregister</button>
              </div>
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
                    styles={customStyles} // Added custom style
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
                    styles={customStyles} // Added custom style
                  />
                </div>
                <button type="submit">Ship'em!</button>
              </form>
            </div>
            {/* Dashboard Section with both Hardcoded and Live Votes */}
            <div className="dashboard-container">
              <h3>Couples Dashboard</h3>
              <div className="dashboard-grid">
                {hardcodedVotes.map((item, index) => (
                  <div key={`hard-${index}`} className="dashboard-card">
                    <h4>{item.couple[0]} &amp; {item.couple[1]}</h4>
                    <p>{item.count} vote{item.count > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
              <hr />
              <h4>Live Votes</h4>
              <div className="dashboard-grid">
                {Object.keys(coupleVotes).length === 0 ? (
                  <p>No live votes yet.</p>
                ) : (
                  Object.entries(coupleVotes).map(([key, count]) => {
                    const [uid1, uid2] = key.split(',');
                    const user1 = users.find(u => u.uid === uid1) || { name: uid1 };
                    const user2 = users.find(u => u.uid === uid2) || { name: uid2 };
                    return (
                      <div key={`live-${key}`} className="dashboard-card">
                        <h4>{user1.name} &amp; {user2.name}</h4>
                        <p>{count} vote{count > 1 ? 's' : ''}</p>
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
