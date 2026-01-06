/**
 * Repositorios - Exportaciones centralizadas
 */

// Base
export { BaseRepository, PaginatedResult, PaginationParams, OrderBy } from './base.repository.js';

// Específicos
export { ProductRepository, productRepository, ProductFilters } from './product.repository.js';
export { CustomerRepository, customerRepository, CustomerFilters } from './customer.repository.js';
