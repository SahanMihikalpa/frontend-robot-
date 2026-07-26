pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    parameters {
        string(name: 'GIT_REPO_URL', defaultValue: 'https://github.com/SahanMihikalpa/frontend-robot-.git', description: 'GitHub repository URL for the frontend')
        string(name: 'GIT_BRANCH', defaultValue: 'main', description: 'Branch to deploy')
        string(name: 'IMAGE_NAME', defaultValue: 'frontend-robot:latest', description: 'Docker image name')
        string(name: 'CONTAINER_NAME', defaultValue: 'frontend-robot', description: 'Docker container name')
        string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: 'http://10.50.227.200:8000', description: 'Frontend API base URL baked into the build')
    }

    environment {
        DOCKER_BUILDKIT = '1'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: "${params.GIT_BRANCH}",
                    url: "${params.GIT_REPO_URL}",
                    credentialsId: 'github-credentials'
            }
        }

        stage('Build Docker Image') {
            steps {
                // 'youtube-api-key' (Secret text) enables YouTube keyword search in the
                // study-break Rest-video. It is baked into the client bundle at build time,
                // so keep the key restricted by HTTP referrer in Google Cloud. If you don't
                // want search, create the credential holding any placeholder value (users can
                // still paste YouTube links without it) or remove this block + the build-arg.
                withCredentials([string(credentialsId: 'youtube-api-key', variable: 'YT_API_KEY')]) {
                    script {
                        if (isUnix()) {
                            sh """
                                docker build \\
                                  --build-arg NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL} \\
                                  --build-arg NEXT_PUBLIC_YOUTUBE_API_KEY=\${YT_API_KEY} \\
                                  -t ${params.IMAGE_NAME} .
                            """
                        } else {
                            bat """
                                docker build ^
                                  --build-arg NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL} ^
                                  --build-arg NEXT_PUBLIC_YOUTUBE_API_KEY=%YT_API_KEY% ^
                                  -t ${params.IMAGE_NAME} .
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy Container') {
            steps {
                script {
                    if (isUnix()) {
                        sh "docker rm -f ${params.CONTAINER_NAME} || true"
                        sh "docker run -d --name ${params.CONTAINER_NAME} -p 3000:3000 --restart unless-stopped ${params.IMAGE_NAME}"
                    } else {
                        bat "docker rm -f ${params.CONTAINER_NAME} || exit /b 0"
                        bat "docker run -d --name ${params.CONTAINER_NAME} -p 3000:3000 --restart unless-stopped ${params.IMAGE_NAME}"
                    }
                }
            }
        }
    }

    post {
        failure {
            echo 'Build or deployment failed. Check the console output for the exact Docker or Git error.'
        }
        success {
            echo 'Frontend image built and deployed successfully on port 3000.'
        }
    }
}