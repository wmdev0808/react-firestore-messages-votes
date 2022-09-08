import React, { useState, useEffect } from "react";

import { LoremIpsum } from "lorem-ipsum";

import { firebase } from "./firebase/firebase";

const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
});

const names = ["Iman", "Daniela", "Pooja", "Amit"];
const authenticatedUser = "Iman";
const messageIds = [];
const messagesNum = 25;
for (let mIdx = 0; mIdx < messagesNum; mIdx++) {
  messageIds.push("M" + mIdx);
}

let firstTime = true;

export default function App() {
  const [messages, setMessages] = useState({});
  const [userTotalVotes, setUserTotalVotes] = useState(0);

  // Generate some messages and votes in the database to start with.
  useEffect(() => {
    const generateMessages = async () => {
      if (firstTime) {
        firstTime = false;
        const totalMVotes = {};
        const mVoteDocs = await firebase.db.collection("mVotes").get();
        console.log({ mVotesNum: mVoteDocs.docs.length });
        if (mVoteDocs.docs.length === 0) {
          for (let mIdx = 0; mIdx < messagesNum; mIdx++) {
            for (let vIdx = 0; vIdx < names.length; vIdx++) {
              console.log({ mIdx, vIdx });
              const voter = names[vIdx];
              const messageId = messageIds[mIdx];
              const userVote = Math.random() < 0.5;
              totalMVotes[messageId]
                ? (totalMVotes[messageId] += userVote)
                : (totalMVotes[messageId] = 0 + userVote);
              const voteRef = firebase.db.collection("mVotes").doc();
              firebase.batchSet(voteRef, {
                messageId,
                voter,
                userVote,
                dateTime: firebase.firestore.Timestamp.fromDate(new Date()),
              });
            }
          }
        }
        const messageDocs = await firebase.db.collection("messages").get();
        console.log({ messagesNum: messageDocs.docs.length });
        if (messageDocs.docs.length === 0) {
          for (let mIdx = 0; mIdx < messagesNum; mIdx++) {
            const sender = names[Math.floor(Math.random() * names.length)];
            const messageId = messageIds[mIdx];
            const messageRef = firebase.db
              .collection("messages")
              .doc(messageId);
            firebase.batchSet(messageRef, {
              sender,
              message: lorem.generateSentences(1),
              totalVotes: totalMVotes[messageId],
              dateTime: firebase.firestore.Timestamp.fromDate(new Date()),
            });
          }
        }
        await firebase.commitBatch();
        console.log("Created all the messages and votes documents.");
      }
    };

    generateMessages();
  }, []);

  // Snapshot listeners to retrieve and combine the data
  useEffect(() => {
    const messagesQuery = firebase.db.collection("messages");
    const messagesSnapshot = messagesQuery.onSnapshot((snapshot) => {
      const docChanges = snapshot.docChanges();
      setMessages((oldMessages) => {
        const oMessages = { ...oldMessages };
        for (let change of docChanges) {
          if (change.doc.id in oMessages) {
            oMessages[change.doc.id] = {
              ...oMessages[change.doc.id],
              ...change.doc.data(),
            };
          } else {
            oMessages[change.doc.id] = change.doc.data();
          }
        }
        return oMessages;
      });
    });

    const votesQuery = firebase.db
      .collection("mVotes")
      .where("voter", "==", authenticatedUser);
    const votesSnapshot = votesQuery.onSnapshot((snapshot) => {
      const docChanges = snapshot.docChanges();
      setMessages((oldMessages) => {
        const oMessages = { ...oldMessages };
        for (let change of docChanges) {
          const voteData = change.doc.data();
          if (voteData.messageId in oMessages) {
            setUserTotalVotes((oldUserTotalVotes) => {
              console.log({
                oldUserTotalVotes,
                mUserVote: oMessages[voteData.messageId].userVote,
                vUserVote: voteData.userVote,
              });
              if (oMessages[voteData.messageId].userVote) {
                if (voteData.userVote) {
                  return oldUserTotalVotes;
                }
                return oldUserTotalVotes - 1;
              }
              if (voteData.userVote) {
                return oldUserTotalVotes + 1;
              }
              return oldUserTotalVotes;
            });
            oMessages[voteData.messageId] = {
              ...oMessages[voteData.messageId],
              voter: voteData.voter,
              userVote: voteData.userVote,
            };
          } else {
            setUserTotalVotes((oldUserTotalVotes) => {
              console.log("Incrementing userTotalVotes");
              return oldUserTotalVotes + voteData.userVote;
            });
            oMessages[voteData.messageId] = {
              voter: voteData.voter,
              userVote: voteData.userVote,
            };
          }
        }
        return oMessages;
      });
    });
    return () => {
      messagesSnapshot();
      votesSnapshot();
    };
  }, []);

  const upVote = (mId) => async (event) => {
    const messageRef = firebase.db.collection("messages").doc(mId);
    await firebase.db.runTransaction(async (t) => {
      const messageDoc = await t.get(messageRef);
      if (messageDoc.exists) {
        const messageData = messageDoc.data();
        const mVoteDocs = await firebase.db
          .collection("mVotes")
          .where("messageId", "==", mId)
          .where("voter", "==", authenticatedUser)
          .get();
        if (mVoteDocs.docs.length > 0) {
          const voteData = mVoteDocs.docs[0].data();
          const mVoteRef = firebase.db
            .collection("mVotes")
            .doc(mVoteDocs.docs[0].id);
          t.update(mVoteRef, {
            userVote: !voteData.userVote,
            dateTime: firebase.firestore.Timestamp.fromDate(new Date()),
          });
          t.update(messageRef, {
            totalVotes: messageData.totalVotes + (voteData.userVote ? -1 : 1),
          });
        } else {
          const mVoteRef = firebase.db.collection("mVotes").doc();
          t.set(mVoteRef, {
            messageId: mId,
            voter: authenticatedUser,
            userVote: true,
            dateTime: firebase.firestore.Timestamp.fromDate(new Date()),
          });
          t.update(messageRef, {
            totalVotes: messageData.totalVotes + 1,
          });
        }
      }
    });
  };

  // const deleteCollections = async () => {
  //   const mVoteDocs = await firebase.db.collection("mVotes").get();
  //   for (let mVoteDoc of mVoteDocs.docs) {
  //     const mVoteRef = firebase.db.collection("mVotes").doc(mVoteDoc.id);
  //     firebase.batchDelete(mVoteRef);
  //   }
  //   const messageDocs = await firebase.db.collection("messages").get();
  //   for (let messageDoc of messageDocs.docs) {
  //     const messageRef = firebase.db.collection("messages").doc(messageDoc.id);
  //     firebase.batchDelete(messageRef);
  //   }
  //   await firebase.commitBatch();
  // };

  return (
    <div className="App">
      {/* <button onClick={deleteCollections}>Delete both collections!</button> */}
      <p>
        <strong>Total User upvotes: </strong>
        {userTotalVotes}
      </p>
      <h1>Messages</h1>
      <ul>
        {Object.keys(messages).map((mId) => {
          const message = messages[mId];
          if (message.voter && message.message) {
            return (
              <li key={mId}>
                <p>
                  From <strong>{message.sender}</strong>, at{" "}
                  {message.dateTime.toDate().toLocaleString()}
                </p>
                <p>{message.message}</p>
                <div>
                  <button
                    style={{
                      backgroundColor: message.userVote ? "green" : "#eeeeee",
                    }}
                    onClick={upVote(mId)}
                  >
                    <span role="img" aria-label="UpVote">
                      �
                    </span>{" "}
                    {message.totalVotes}
                  </button>
                </div>
              </li>
            );
          }
        })}
      </ul>
    </div>
  );
}
