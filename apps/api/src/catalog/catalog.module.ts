import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { UnitsController } from "./units.controller";
import { UnitsService } from "./units.service";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [CatalogController, CategoriesController, UnitsController],
  providers: [CatalogService, CategoriesService, UnitsService],
  exports: [CatalogService, CategoriesService, UnitsService],
})
export class CatalogModule {}
