#!/bin/bash
# Run only in a disposable Linux container: this uses the deploy script's fixed paths.
set -euo pipefail
mkdir -p /tmp/mock-bin /home/ubuntu/koleksiyonum-staging /home/ubuntu/koleksiyonum-ci /run/lock
touch /home/ubuntu/koleksiyonum-staging/.env.staging.local
cat > /tmp/mock-bin/docker <<'MOCK'
#!/bin/bash
echo "${BACKEND_IMAGE:-unset} $*" >> /tmp/docker-calls
if [[ $1 == inspect ]]; then echo sha256:previous; fi
if [[ $1 == compose && " $* " == *' run '* && ${SCENARIO:-} == migration-fail ]]; then exit 1; fi
if [[ $1 == compose && " $* " == *' up '* && ${SCENARIO:-} == health-fail && ${BACKEND_IMAGE:-} != koleksiyonum-backend:rollback ]]; then exit 1; fi
MOCK
chmod +x /tmp/mock-bin/docker
export PATH="/tmp/mock-bin:$PATH"
sha=0123456789012345678901234567890123456789
for scenario in success migration-fail health-fail; do
  export SCENARIO=$scenario
  : > /tmp/docker-calls
  touch "/home/ubuntu/koleksiyonum-ci/$sha.tar.gz"
  if bash /source/deploy/staging/deploy-ci.sh "$sha"; then result=0; else result=$?; fi
  case "$scenario" in
    success)
      [[ $result == 0 ]]
      [[ $(cat /home/ubuntu/koleksiyonum-staging/.deployed-image) == "koleksiyonum-backend:sha-$sha" ]]
      [[ ! -e /home/ubuntu/koleksiyonum-ci/$sha.tar.gz ]]
      ;;
    migration-fail)
      [[ $result != 0 ]]
      ! grep -q ' up ' /tmp/docker-calls
      ;;
    health-fail)
      [[ $result != 0 ]]
      grep -q 'koleksiyonum-backend:rollback compose .* up ' /tmp/docker-calls
      ;;
  esac
done
if bash /source/deploy/staging/deploy-ci.sh '../bad'; then exit 1; fi
echo 'Deploy tests passed: success, migration failure, rollback and invalid SHA.'
