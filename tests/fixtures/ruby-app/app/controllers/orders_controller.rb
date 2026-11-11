class OrdersController < ApplicationController
  before_action :authenticate_user!

  def index
    render json: Order.all
  end
end
