import fbApp from "firebase/compat/app";
import "firebase/compat/firestore";

import { firebaseConfig } from "./config";

const MAX_TRANSACTION_WRITES = 499;

const isFirestoreDeadlineError = (err) => {
  return err.message.includes("DEADLINE_EXCEEDED");
};

class Firebase {
  constructor(fireConfig, instanceName) {
    let app = fbApp;
    if (instanceName) {
      app = app.initializeApp(fireConfig, instanceName);
    } else {
      app.initializeApp(fireConfig);
    }
    this.name = app.name;
    this.db = app.firestore();
    this.firestore = app.firestore;
    // How many transactions/batchWrites out of 500 so far.
    // I wrote the following functions to easily use batchWrites wthout worrying about the 500 limit.
    this.writeCounts = 0;
    this.batch = this.db.batch();
    this.isCommitting = false;
  }

  async makeCommitBatch() {
    console.log("makeCommitBatch");
    if (!this.isCommitting) {
      this.isCommitting = true;
      await this.batch.commit();
      this.writeCounts = 0;
      this.batch = this.db.batch();
      this.isCommitting = false;
    } else {
      const batchWaitInterval = setInterval(async () => {
        if (!this.isCommitting) {
          this.isCommitting = true;
          await this.batch.commit();
          this.writeCounts = 0;
          this.batch = this.db.batch();
          this.isCommitting = false;
          clearInterval(batchWaitInterval);
        }
      }, 400);
    }
  }

  async commitBatch() {
    try {
      await this.makeCommitBatch();
    } catch (err) {
      console.log({ err });
      if (isFirestoreDeadlineError(err)) {
        const theInterval = setInterval(async () => {
          try {
            await this.makeCommitBatch();
            clearInterval(theInterval);
          } catch (err) {
            console.log({ err });
            if (!isFirestoreDeadlineError(err)) {
              clearInterval(theInterval);
              throw err;
            }
          }
        }, 4000);
      }
    }
  }

  async checkRestartBatchWriteCounts() {
    this.writeCounts += 1;
    if (this.writeCounts >= MAX_TRANSACTION_WRITES) {
      await this.commitBatch();
    }
  }

  async batchSet(docRef, docData) {
    if (!this.isCommitting) {
      this.batch.set(docRef, docData);
      await this.checkRestartBatchWriteCounts();
    } else {
      const batchWaitInterval = setInterval(async () => {
        if (!this.isCommitting) {
          this.batch.set(docRef, docData);
          await this.checkRestartBatchWriteCounts();
          clearInterval(batchWaitInterval);
        }
      }, 400);
    }
  }

  async batchUpdate(docRef, docData) {
    if (!this.isCommitting) {
      this.batch.update(docRef, docData);
      await this.checkRestartBatchWriteCounts();
    } else {
      const batchWaitInterval = setInterval(async () => {
        if (!this.isCommitting) {
          this.batch.update(docRef, docData);
          await this.checkRestartBatchWriteCounts();
          clearInterval(batchWaitInterval);
        }
      }, 400);
    }
  }

  async batchDelete(docRef) {
    if (!this.isCommitting) {
      this.batch.delete(docRef);
      await this.checkRestartBatchWriteCounts();
    } else {
      const batchWaitInterval = setInterval(async () => {
        if (!this.isCommitting) {
          this.batch.delete(docRef);
          await this.checkRestartBatchWriteCounts();
          clearInterval(batchWaitInterval);
        }
      }, 400);
    }
  }
}

export const firebase = new Firebase(firebaseConfig);
