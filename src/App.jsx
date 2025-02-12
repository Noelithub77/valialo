import { useState, useEffect } from 'react'
import './App.css'

// Firebase imports remain unchanged...
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, setDoc, doc, getDocs, addDoc } from "firebase/firestore";

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

function App() {
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [vote1, setVote1] = useState('')
  const [vote2, setVote2] = useState('')
  const [coupleVotes, setCoupleVotes] = useState({})  // New state for votes overview

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
      storeUserData(signedInUser);
    } catch (error) {
      console.error("Error during sign in: ", error);
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
              <p>Choose two people to ship as a couple:</p>
              <form onSubmit={handleVoteSubmit}>
                <div className="dropdown-group">
                  <label>Select first user:</label>
                  <select value={vote1} onChange={(e) => setVote1(e.target.value)}>
                    <option value="">--Select--</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dropdown-group">
                  <label>Select second user:</label>
                  <select value={vote2} onChange={(e) => setVote2(e.target.value)}>
                    <option value="">--Select--</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit">Ship Them!</button>
              </form>
            </div>
            {/* New: Votes Dashboard */}
            <div className="dashboard-container">
              <h3>Couples Dashboard</h3>
              {Object.keys(coupleVotes).length === 0 ? (
                <p>No votes yet.</p>
              ) : (
                <ul>
                  {Object.entries(coupleVotes).map(([key, count]) => {
                    // Resolve uids to names