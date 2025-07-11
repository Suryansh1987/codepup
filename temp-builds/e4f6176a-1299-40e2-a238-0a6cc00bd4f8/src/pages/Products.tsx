import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { ShoppingCart, Filter, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState('all');
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, priceRange]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products...');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Products error:', error);
        throw error;
      }
      
      console.log('Products loaded:', data?.length || 0);
      setProducts(data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
      
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by price range
    if (priceRange !== 'all') {
      switch (priceRange) {
        case 'under-500':
          filtered = filtered.filter(product => product.price < 500);
          break;
        case '500-1000':
          filtered = filtered.filter(product => product.price >= 500 && product.price < 1000);
          break;
        case '1000-2000':
          filtered = filtered.filter(product => product.price >= 1000 && product.price < 2000);
          break;
        case 'over-2000':
          filtered = filtered.filter(product => product.price >= 2000);
          break;
      }
    }

    setFilteredProducts(filtered);
  };

  const handleAddToCart = async (product: any) => {
    try {
      await addToCart(product);
      toast.success('Added to cart!');
    } catch (error) {
      console.error('Add to cart error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-4">Our Tables Collection</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover our complete range of premium tables, from elegant dining sets to functional work desks.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Price Range Filter */}
            <div>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Prices</option>
                <option value="under-500">Under $500</option>
                <option value="500-1000">$500 - $1000</option>
                <option value="1000-2000">$1000 - $2000</option>
                <option value="over-2000">Over $2000</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-center md:justify-end">
              <span className="text-sm text-gray-600">
                {filteredProducts.length} products found
              </span>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Product Image */}
                <div className="aspect-w-16 aspect-h-12 bg-gray-200 relative">
                  <img 
                    src={product.image_url || '/api/placeholder/400/300'} 
                    alt={product.name}
                    className="w-full h-64 object-cover"
                  />
                  {product.is_featured && (
                    <div className="absolute top-4 left-4 bg-primary text-white px-2 py-1 rounded-full text-xs font-medium">
                      Featured
                    </div>
                  )}
                  {product.stock_quantity === 0 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">Out of Stock</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <div className="mb-2">
                    {product.category && (
                      <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium mb-2">
                        {product.category}
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {product.description || 'No description available'}
                    </p>
                  </div>

                  {/* Price and Stock */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-primary">${product.price?.toFixed(2) || '0.00'}</span>
                      {product.stock_quantity > 0 && (
                        <p className="text-sm text-gray-500">{product.stock_quantity} in stock</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-accent fill-current" />
                      <span className="text-sm text-gray-600">4.5</span>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button 
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock_quantity === 0}
                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;