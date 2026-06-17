import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.getMe(user.sub);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateMe(user.sub, dto);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.userService.getUserPublic(id);
  }

  @Get('me/friends')
  async getFriends(@CurrentUser() user: JwtPayload) {
    return this.userService.getFriends(user.sub);
  }

  @Post('me/friends/:friendId')
  @HttpCode(HttpStatus.OK)
  async addFriend(
    @CurrentUser() user: JwtPayload,
    @Param('friendId') friendId: string,
  ) {
    return this.userService.addFriend(user.sub, friendId, 'in_room');
  }

  @Delete('me/friends/:friendId')
  async removeFriend(
    @CurrentUser() user: JwtPayload,
    @Param('friendId') friendId: string,
  ) {
    return this.userService.removeFriend(user.sub, friendId);
  }
}
