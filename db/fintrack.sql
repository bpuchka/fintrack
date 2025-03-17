-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema fintrack
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema fintrack
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `fintrack` DEFAULT CHARACTER SET utf8mb3 ;
USE `fintrack` ;

-- -----------------------------------------------------
-- Table `fintrack`.`users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(45) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `isAdmin` TINYINT(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`bank_investment`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`bank_investment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `initial_capital` DECIMAL(15,2) NOT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL,
  `interest_period` VARCHAR(50) NOT NULL,
  `investment_date` DATE NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bank_investment_id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `fk_table1_Users` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_table1_Users`
    FOREIGN KEY (`user_id`)
    REFERENCES `fintrack`.`users` (`id`)
    ON DELETE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`blog_post`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`blog_post` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `author_id` INT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `content` TEXT NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `title` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_blog_post_Users1_idx` (`author_id` ASC) VISIBLE,
  CONSTRAINT `fk_blog_post_Users1`
    FOREIGN KEY (`author_id`)
    REFERENCES `fintrack`.`users` (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`investment_prices`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`investment_prices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `symbol` VARCHAR(10) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `asset_type` ENUM('stock', 'crypto', 'commodity', 'forex', 'etf') NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `symbol` (`symbol` ASC, `timestamp` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 3431
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`user_investments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`user_investments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `investment_type` ENUM('bank', 'crypto', 'stock', 'metal') NOT NULL,
  `symbol` VARCHAR(10) NOT NULL COMMENT 'Asset symbol (e.g., BTC, AAPL) or bank reference',
  `quantity` DECIMAL(10,2) NOT NULL COMMENT 'Amount of units or deposit amount for banks',
  `purchase_price` DECIMAL(10,2) NOT NULL COMMENT 'Price per unit or set to 1 for bank deposits',
  `currency` ENUM('BGN', 'USD', 'EUR', 'GBP') NULL DEFAULT NULL COMMENT 'Currency for bank deposits',
  `interest_rate` DECIMAL(5,2) NULL DEFAULT NULL COMMENT 'Interest rate percentage for bank deposits',
  `interest_type` ENUM('daily', 'monthly_1', 'monthly_3', 'monthly_6', 'yearly') NULL DEFAULT NULL COMMENT 'Interest calculation period for bank deposits',
  `purchase_date` DATETIME NOT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `user_id` (`user_id` ASC) VISIBLE,
  INDEX `idx_investment_type` (`investment_type` ASC) VISIBLE,
  CONSTRAINT `user_investments_ibfk_1`
    FOREIGN KEY (`user_id`)
    REFERENCES `fintrack`.`users` (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb3
COMMENT = 'Stores all user investment types including cryptocurrencies, stocks, metals, and bank deposits';


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
