"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  APP: {
    PING: "app:ping",
    OPEN_EXTERNAL: "app:open-external"
  },
  AUTH: {
    // 토큰(PAT) 로그인
    SET_TOKEN: "auth:set-token",
    LOGOUT: "auth:logout",
    GET_USER: "auth:get-user",
    GET_TOKEN_STATUS: "auth:get-token-status"
  },
  GIT: {
    CLONE: "git:clone",
    STATUS: "git:status",
    FETCH: "git:fetch",
    PULL: "git:pull",
    PUSH: "git:push",
    CHANGES: "git:changes",
    STAGE: "git:stage",
    UNSTAGE: "git:unstage",
    COMMIT: "git:commit",
    LOG: "git:log",
    DIFF: "git:diff",
    BRANCH_LIST: "git:branch-list",
    BRANCH_CHECKOUT: "git:branch-checkout",
    BRANCH_CREATE: "git:branch-create",
    BRANCH_DELETE: "git:branch-delete",
    MERGE: "git:merge",
    ORIGIN_URL: "git:origin-url"
  },
  GITHUB: {
    // MVP에서는 인증/사용자 정보부터 연결
    // 이후 PR/Issue/Repo API를 단계적으로 추가
    GET_MY_PROFILE: "github:get-my-profile",
    LIST_PULLS: "github:list-pulls",
    REVIEW_PULL: "github:review-pull",
    MERGE_PULL: "github:merge-pull",
    CREATE_PULL: "github:create-pull",
    LIST_ISSUES: "github:list-issues",
    CREATE_ISSUE: "github:create-issue",
    CLOSE_ISSUE: "github:close-issue",
    COMMENT_ISSUE: "github:comment-issue",
    LIST_REPOS: "github:list-repos",
    CREATE_REPO: "github:create-repo"
  },
  STORE: {
    GET_LEARNING_PROGRESS: "store:get-learning-progress",
    UPDATE_LEARNING_PROGRESS: "store:update-learning-progress",
    GET_GUIDE_COMPLETED: "store:get-guide-completed",
    SET_GUIDE_COMPLETED: "store:set-guide-completed",
    GET_PROJECTS: "store:get-projects",
    SAVE_PROJECTS: "store:save-projects"
  }
};
electron.contextBridge.exposeInMainWorld("easyGithub", {
  app: {
    ping: () => electron.ipcRenderer.invoke(IPC_CHANNELS.APP.PING),
    openExternal: (url) => electron.ipcRenderer.invoke(IPC_CHANNELS.APP.OPEN_EXTERNAL, url)
  },
  auth: {
    // 토큰(PAT) 로그인
    setToken: (token) => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH.SET_TOKEN, token),
    logout: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGOUT),
    getUser: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH.GET_USER),
    getTokenStatus: () => electron.ipcRenderer.invoke(IPC_CHANNELS.AUTH.GET_TOKEN_STATUS)
  },
  github: {
    getMyProfile: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_MY_PROFILE),
    listPullRequests: (owner, repo) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_PULLS, owner, repo),
    reviewPullRequest: (owner, repo, pullNumber, event, body) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.REVIEW_PULL, owner, repo, pullNumber, event, body),
    mergePullRequest: (owner, repo, pullNumber) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.MERGE_PULL, owner, repo, pullNumber),
    createPullRequest: (owner, repo, title, body, head, base) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_PULL, owner, repo, title, body, head, base),
    listIssues: (owner, repo, state) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_ISSUES, owner, repo, state),
    createIssue: (owner, repo, title, body) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_ISSUE, owner, repo, title, body),
    closeIssue: (owner, repo, issueNumber) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CLOSE_ISSUE, owner, repo, issueNumber),
    commentIssue: (owner, repo, issueNumber, body) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.COMMENT_ISSUE, owner, repo, issueNumber, body),
    listRepositories: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.LIST_REPOS),
    createRepository: (name, description, isPrivate) => electron.ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CREATE_REPO, name, description, isPrivate)
  },
  git: {
    clone: (repoUrl, targetPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.CLONE, repoUrl, targetPath),
    status: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.STATUS, repoPath),
    fetch: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.FETCH, repoPath),
    pull: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.PULL, repoPath),
    push: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.PUSH, repoPath),
    changes: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.CHANGES, repoPath),
    stage: (repoPath, files) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.STAGE, repoPath, files),
    unstage: (repoPath, files) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.UNSTAGE, repoPath, files),
    commit: (repoPath, message) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.COMMIT, repoPath, message),
    log: (repoPath, maxCount) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.LOG, repoPath, maxCount),
    diff: (repoPath, filePath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.DIFF, repoPath, filePath),
    branches: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_LIST, repoPath),
    checkoutBranch: (repoPath, branchName) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_CHECKOUT, repoPath, branchName),
    createBranch: (repoPath, branchName, baseBranch) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_CREATE, repoPath, branchName, baseBranch),
    deleteBranch: (repoPath, branchName) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.BRANCH_DELETE, repoPath, branchName),
    merge: (repoPath, fromBranch) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.MERGE, repoPath, fromBranch),
    originUrl: (repoPath) => electron.ipcRenderer.invoke(IPC_CHANNELS.GIT.ORIGIN_URL, repoPath)
  },
  store: {
    getLearningProgress: () => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_LEARNING_PROGRESS),
    updateLearningProgress: (partial) => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.UPDATE_LEARNING_PROGRESS, partial),
    getGuideCompleted: () => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_GUIDE_COMPLETED),
    setGuideCompleted: (completed) => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.SET_GUIDE_COMPLETED, completed),
    getProjects: () => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.GET_PROJECTS),
    saveProjects: (projects) => electron.ipcRenderer.invoke(IPC_CHANNELS.STORE.SAVE_PROJECTS, projects)
  }
});
