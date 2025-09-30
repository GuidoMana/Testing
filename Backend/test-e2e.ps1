# PowerShell script to run e2e tests with coverage
Write-Host "Starting e2e tests with coverage..."

# Set environment variable for test
$env:NODE_ENV = "test"

# Run database setup
Write-Host "Setting up test database..."
& npm run db:test:up

# Run migrations
Write-Host "Running migrations..."
& npm run typeorm -- migration:run

# Run tests with coverage
Write-Host "Running e2e tests..."
& npx jest --config ./test/jest-e2e.json --coverage

# Clean up database
Write-Host "Cleaning up test database..."
& npm run db:test:down

Write-Host "E2E tests completed!"
