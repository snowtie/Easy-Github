export const IPC_CHANNELS = {
  APP: {
    PING: 'app:ping',
    OPEN_EXTERNAL: 'app:open-external',
    SELECT_DIRECTORY: 'app:select-directory',
    CHECK_FOR_UPDATES: 'app:check-for-updates',
    DOWNLOAD_UPDATE: 'app:download-update',
    INSTALL_UPDATE: 'app:install-update',
    GET_APP_VERSION: 'app:get-app-version',
    UPDATE_EVENT: 'app:update-event'
  },
  AUTH: {
    // 토큰(PAT) 로그인
    SET_TOKEN: 'auth:set-token',

    LOGOUT: 'auth:logout',
    GET_USER: 'auth:get-user',
    GET_TOKEN_STATUS: 'auth:get-token-status'
  },
  GIT: {
    CLONE: 'git:clone',
    STATUS: 'git:status',
    FETCH: 'git:fetch',
    PULL: 'git:pull',
    PUSH: 'git:push',

    CHANGES: 'git:changes',
    STAGE: 'git:stage',
    UNSTAGE: 'git:unstage',
    COMMIT: 'git:commit',
    LOG: 'git:log',
    DIFF: 'git:diff',

    BRANCH_LIST: 'git:branch-list',
    BRANCH_CHECKOUT: 'git:branch-checkout',
    BRANCH_CREATE: 'git:branch-create',
    BRANCH_DELETE: 'git:branch-delete',
    MERGE: 'git:merge',
    ORIGIN_URL: 'git:origin-url',
    CHECK_INSTALLED: 'git:check-installed'
  },
  GITHUB: {
    // MVP에서는 인증/사용자 정보부터 연결
    // 이후 PR/Issue/Repo API를 단계적으로 추가
    GET_MY_PROFILE: 'github:get-my-profile',

    LIST_PULLS: 'github:list-pulls',
    REVIEW_PULL: 'github:review-pull',
    MERGE_PULL: 'github:merge-pull',
    CREATE_PULL: 'github:create-pull',

    LIST_ISSUES: 'github:list-issues',
    CREATE_ISSUE: 'github:create-issue',
    CLOSE_ISSUE: 'github:close-issue',
    COMMENT_ISSUE: 'github:comment-issue',
    LIST_REPOS: 'github:list-repos',
    CREATE_REPO: 'github:create-repo'
  },
  TODOS: {
    LIST: 'todos:list',
    UPDATE: 'todos:update',
    ADD: 'todos:add'
  },
  STORE: {
    GET_LEARNING_PROGRESS: 'store:get-learning-progress',
    UPDATE_LEARNING_PROGRESS: 'store:update-learning-progress',
    GET_GUIDE_COMPLETED: 'store:get-guide-completed',
    SET_GUIDE_COMPLETED: 'store:set-guide-completed',
    GET_PROJECTS: 'store:get-projects',
    SAVE_PROJECTS: 'store:save-projects'
  }
} as const
