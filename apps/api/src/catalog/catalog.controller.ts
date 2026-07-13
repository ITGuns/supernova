import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.getCategories();
  }

  @Get('products')
  products(@Query('category') category?: string, @Query('q') q?: string) {
    return this.catalog.listProducts({ categoryId: category, q });
  }

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.catalog.getProduct(id);
  }
}
