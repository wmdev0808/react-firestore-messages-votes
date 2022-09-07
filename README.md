# Requirements

We are building a chat app, where users vote on each other's messages.

We have two Firestore collections:

- `messages`: contains the `id`, `message` (text), `sender`, `dateTime`, `totalVotes`, ....
- `mVotes`: contains the `userVote`, `voter`, `messageId`, `dateTime`, ....

And two React states:

- `messages`: is an object with the message `id` as a key and the value is an object including the `message` (text), `sender`, `dateTime`, and `totalVotes`, in addition to `userVote` from the `mVotes` collection.
- `userTotalVotes`: is the total votes the authenticated user has cast so far. The value is not saved in the database and is calculated in the front-end.

We have two Firestore `onSnapshot`s that listen to all the changes in messages and `mVotes` collections. This way, as soon as a message is added/updated or the user casts or changes their vote on a message, messages and `userTotalVotes` get updated and the corresponding changes are shown in the UI.

We defined these listeners in a `useEffect` with no dependencies. Every time something changes in messages or `mVotes`, inside Firestore `onSnapshot`s we call `setMessages` and `setUserTotalVotes`, and get their previous value to update accordingly. However, when a user votes on a message, because simultaneously:

- The message document changes it `totalVotes`
- The `mVote` document changes its `userVote`

both Firestore `onSnapshot`s get fired, but only one of the `setMessages` and `setUserTotalVotes` calls works fine. The other one messes up.

How would you solve this issue.
