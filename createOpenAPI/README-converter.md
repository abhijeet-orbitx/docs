# Swagger to OpenAPI 3.1 Converter

A comprehensive JavaScript tool that converts Swagger/OpenAPI specifications to OpenAPI 3.1 format with validation and detailed error reporting.

## Features

- ✅ **Full Conversion**: Converts Swagger 2.0 and OpenAPI 3.0 to OpenAPI 3.1
- ✅ **Comprehensive Validation**: Validates both input and output specifications
- ✅ **Detailed Error Reporting**: Shows specific validation errors and recommendations
- ✅ **Reference Conversion**: Automatically converts Swagger 2.0 references to OpenAPI 3.1 format
- ✅ **Schema Migration**: Handles complex schema conversions including nested objects, arrays, and references
- ✅ **Security Schemes**: Converts authentication and authorization schemes
- ✅ **CLI Interface**: Easy-to-use command-line interface
- ✅ **Error Handling**: Graceful error handling with informative messages

## Installation

1. **Install Dependencies**:
   ```bash
   npm install @apidevtools/swagger-parser ajv ajv-formats
   ```

2. **Make the script executable** (optional):
   ```bash
   chmod +x convertSwagger.js
   ```

## Usage

### Basic Usage

```bash
node convertSwagger.js <input-file> <output-file>
```

### Examples

```bash
# Convert swagger.json to openapi.json
node convertSwagger.js swagger.json openapi.json

# Convert with custom paths
node convertSwagger.js ./api/swagger.json ./output/openapi.json

# Convert from different directory
node convertSwagger.js ../api/swagger.json ./converted/openapi.json
```

### Programmatic Usage

```javascript
const SwaggerToOpenAPIConverter = require('./convertSwagger.js');

const converter = new SwaggerToOpenAPIConverter();
converter.convert('swagger.json', 'openapi.json');
```

## What Gets Converted

### 1. Version Update
- Updates `openapi` version to `3.1.0`

### 2. Server Configuration
- Converts legacy `host` and `basePath` to `servers` array
- Preserves existing `servers` configuration

### 3. Schema References
- `#/definitions/` → `#/components/schemas/`
- `#/parameters/` → `#/components/parameters/`
- `#/responses/` → `#/components/responses/`
- `#/securityDefinitions/` → `#/components/securitySchemes/`

### 4. Components Structure
- Migrates `definitions` to `components.schemas`
- Migrates `parameters` to `components.parameters`
- Migrates `responses` to `components.responses`
- Migrates `securityDefinitions` to `components.securitySchemes`

### 5. Schema Properties
- Converts `required` arrays properly
- Handles `nullable` properties
- Preserves validation rules (min/max, patterns, etc.)
- Converts `allOf`, `anyOf`, `oneOf` combinations

### 6. Security Schemes
- Converts HTTP Bearer authentication
- Converts API Key authentication
- Converts OAuth2 flows
- Converts OpenID Connect

## Validation

The converter performs comprehensive validation:

### Input Validation
- Validates that the input file exists and is valid JSON
- Checks if the specification follows Swagger/OpenAPI standards
- Reports any issues with the input specification

### Output Validation
- Validates the converted specification against OpenAPI 3.1 schema
- Checks for required properties and correct structure
- Reports any validation errors or warnings

## Error Handling

The converter provides detailed error reporting:

### Validation Errors
- Shows specific validation failures
- Provides file paths and line numbers where possible
- Categorizes errors by type (input vs output)

### Conversion Warnings
- Reports any issues during conversion
- Suggests manual fixes for complex cases
- Provides recommendations for improvement

## Common Issues and Solutions

### 1. Schema Reference Errors
**Problem**: References pointing to old Swagger 2.0 paths
**Solution**: The converter automatically updates references, but you may need to manually verify complex nested references.

### 2. Required Property Errors
**Problem**: `required` properties not properly formatted
**Solution**: The converter handles most cases, but complex nested schemas may need manual review.

### 3. Security Scheme Validation
**Problem**: Security schemes not conforming to OpenAPI 3.1
**Solution**: Review and update security scheme definitions according to OpenAPI 3.1 specification.

### 4. Content Type Issues
**Problem**: Missing or incorrect content types
**Solution**: Ensure all responses have proper `content` objects with media types.

## Output Format

The converted file will be:
- **Formatted**: Properly indented JSON
- **Validated**: Conforms to OpenAPI 3.1 specification
- **Complete**: All components properly migrated
- **Compatible**: Works with OpenAPI 3.1 tools and generators

## Example Output

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0",
    "description": "API description"
  },
  "servers": [
    {
      "url": "https://api.example.com/v1"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "summary": "Get users",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UserList"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "UserList": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/User"
        }
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
```

## Troubleshooting

### File Not Found
```
❌ Conversion failed: Input file not found: swagger.json
```
**Solution**: Check the file path and ensure the file exists.

### JSON Parse Error
```
❌ Conversion failed: Unexpected token in JSON
```
**Solution**: Ensure your input file is valid JSON.

### Validation Errors
```
⚠️ Input validation warnings (continuing with conversion)
```
**Solution**: Review the validation errors and fix issues in your source specification.

### Permission Errors
```
❌ Conversion failed: EACCES: permission denied
```
**Solution**: Check file permissions and ensure you have write access to the output directory.

## Contributing

To improve the converter:

1. **Report Issues**: Create detailed bug reports with examples
2. **Suggest Features**: Propose new conversion capabilities
3. **Submit PRs**: Contribute code improvements and fixes

## License

This tool is provided as-is for converting Swagger specifications to OpenAPI 3.1 format.

## Support

For issues and questions:
1. Check the error messages and recommendations
2. Review the OpenAPI 3.1 specification
3. Validate your input specification manually
4. Test with smaller portions of your API specification 