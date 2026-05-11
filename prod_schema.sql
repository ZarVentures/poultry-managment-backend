--
-- PostgreSQL database dump
--

\restrict CrcKAa00fZwdynNCpCTC9yLcgWRLFCsnfpRdoJNEDcc84dArot9mJgqt8Y6w2bf

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: expense_category_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.expense_category_type AS ENUM (
    'feed',
    'labor',
    'medicine',
    'utilities',
    'equipment',
    'maintenance',
    'transportation',
    'other'
);


ALTER TYPE public.expense_category_type OWNER TO poultry_user;

--
-- Name: payment_method_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.payment_method_type AS ENUM (
    'cash',
    'bank_transfer',
    'check',
    'credit_card'
);


ALTER TYPE public.payment_method_type OWNER TO poultry_user;

--
-- Name: payment_status_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.payment_status_type AS ENUM (
    'paid',
    'pending',
    'partial'
);


ALTER TYPE public.payment_status_type OWNER TO poultry_user;

--
-- Name: product_status_enum; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.product_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.product_status_enum OWNER TO poultry_user;

--
-- Name: product_type_enum; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.product_type_enum AS ENUM (
    'eggs',
    'meat',
    'chicks',
    'feed',
    'medicine',
    'equipment',
    'other'
);


ALTER TYPE public.product_type_enum OWNER TO poultry_user;

--
-- Name: purchase_status; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.purchase_status AS ENUM (
    'pending',
    'received',
    'cancelled'
);


ALTER TYPE public.purchase_status OWNER TO poultry_user;

--
-- Name: sale_mode_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.sale_mode_type AS ENUM (
    'from_vehicle',
    'from_godown'
);


ALTER TYPE public.sale_mode_type OWNER TO poultry_user;

--
-- Name: sale_product_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.sale_product_type AS ENUM (
    'eggs',
    'meat',
    'chicks',
    'other'
);


ALTER TYPE public.sale_product_type OWNER TO poultry_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'manager',
    'staff'
);


ALTER TYPE public.user_role OWNER TO poultry_user;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.user_status OWNER TO poultry_user;

--
-- Name: vehicle_status_type; Type: TYPE; Schema: public; Owner: poultry_user
--

CREATE TYPE public.vehicle_status_type AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.vehicle_status_type OWNER TO poultry_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id bigint,
    user_email character varying(255),
    action character varying(50) NOT NULL,
    entity character varying(100) NOT NULL,
    entity_id character varying(100),
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO poultry_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO poultry_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cages; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.cages (
    id bigint NOT NULL,
    cage_id character varying(50),
    purchase_order_id bigint NOT NULL,
    number_of_birds integer DEFAULT 0 NOT NULL,
    purchase_weight numeric(10,2) DEFAULT 0 NOT NULL,
    sale_weight numeric(10,2),
    godown_inward_weight numeric(10,2),
    godown_sale_weight numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    vehicle_id bigint,
    sale_id bigint,
    godown_inward_id bigint,
    godown_sale_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cages OWNER TO poultry_user;

--
-- Name: cages_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.cages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cages_id_seq OWNER TO poultry_user;

--
-- Name: cages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.cages_id_seq OWNED BY public.cages.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.expenses (
    id bigint NOT NULL,
    expense_date date NOT NULL,
    expense_owner character varying(150),
    category public.expense_category_type NOT NULL,
    description text NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_method public.payment_method_type NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.expenses OWNER TO poultry_user;

--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expenses_id_seq OWNER TO poultry_user;

--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: farmers; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.farmers (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    phone character varying(50),
    email character varying(150),
    address text,
    farmhouse_name character varying(150),
    notes text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.farmers OWNER TO poultry_user;

--
-- Name: farmers_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.farmers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.farmers_id_seq OWNER TO poultry_user;

--
-- Name: farmers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.farmers_id_seq OWNED BY public.farmers.id;


--
-- Name: godown_expenses; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_expenses (
    id bigint NOT NULL,
    expense_date date NOT NULL,
    category public.expense_category_type NOT NULL,
    description text NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_method public.payment_method_type NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.godown_expenses OWNER TO poultry_user;

--
-- Name: godown_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_expenses_id_seq OWNER TO poultry_user;

--
-- Name: godown_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_expenses_id_seq OWNED BY public.godown_expenses.id;


--
-- Name: godown_inward_entries; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_inward_entries (
    id bigint NOT NULL,
    entry_date date NOT NULL,
    purchase_invoice_no character varying(50),
    supplier_name character varying(150),
    vehicle_id bigint,
    number_of_birds integer NOT NULL,
    average_weight numeric(10,2),
    total_weight numeric(10,2),
    rate_per_kg numeric(10,2),
    total_amount numeric(14,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.godown_inward_entries OWNER TO poultry_user;

--
-- Name: godown_inward_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_inward_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_inward_entries_id_seq OWNER TO poultry_user;

--
-- Name: godown_inward_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_inward_entries_id_seq OWNED BY public.godown_inward_entries.id;


--
-- Name: godown_mortalities; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_mortalities (
    id bigint NOT NULL,
    record_number character varying(50) NOT NULL,
    record_date date NOT NULL,
    item_type character varying(50),
    quantity numeric(14,2) DEFAULT 0,
    cause text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.godown_mortalities OWNER TO poultry_user;

--
-- Name: godown_mortalities_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_mortalities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_mortalities_id_seq OWNER TO poultry_user;

--
-- Name: godown_mortalities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_mortalities_id_seq OWNED BY public.godown_mortalities.id;


--
-- Name: godown_mortality; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_mortality (
    id bigint NOT NULL,
    mortality_date date NOT NULL,
    number_of_birds_died integer NOT NULL,
    reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_of_dead_birds numeric(10,2),
    godown_inward_id bigint
);


ALTER TABLE public.godown_mortality OWNER TO poultry_user;

--
-- Name: godown_mortality_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_mortality_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_mortality_id_seq OWNER TO poultry_user;

--
-- Name: godown_mortality_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_mortality_id_seq OWNED BY public.godown_mortality.id;


--
-- Name: godown_sale_payments; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_sale_payments (
    id bigint NOT NULL,
    godown_sale_id bigint NOT NULL,
    payment_mode character varying(30) NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.godown_sale_payments OWNER TO poultry_user;

--
-- Name: godown_sale_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_sale_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_sale_payments_id_seq OWNER TO poultry_user;

--
-- Name: godown_sale_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_sale_payments_id_seq OWNED BY public.godown_sale_payments.id;


--
-- Name: godown_sales; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.godown_sales (
    id bigint NOT NULL,
    sale_date date NOT NULL,
    invoice_number character varying(50),
    customer_name character varying(150) NOT NULL,
    retailer_id bigint,
    vehicle_id bigint,
    number_of_birds integer NOT NULL,
    average_weight numeric(10,2),
    total_weight numeric(10,2),
    rate_per_kg numeric(10,2),
    total_amount numeric(14,2),
    payment_status public.payment_status_type NOT NULL,
    amount_received numeric(14,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_mode character varying(50)
);


ALTER TABLE public.godown_sales OWNER TO poultry_user;

--
-- Name: godown_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.godown_sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.godown_sales_id_seq OWNER TO poultry_user;

--
-- Name: godown_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.godown_sales_id_seq OWNED BY public.godown_sales.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    item_type character varying(50) NOT NULL,
    item_name character varying(150) NOT NULL,
    quantity numeric(14,2) DEFAULT 0 NOT NULL,
    unit character varying(20) NOT NULL,
    minimum_stock_level numeric(14,2) DEFAULT 0 NOT NULL,
    current_stock_level numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.inventory_items OWNER TO poultry_user;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_items_id_seq OWNER TO poultry_user;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: mortalities; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.mortalities (
    id bigint NOT NULL,
    record_number character varying(50) NOT NULL,
    purchase_order_id bigint,
    purchase_invoice_no character varying(50) NOT NULL,
    purchase_date date NOT NULL,
    farmer_name character varying(150) NOT NULL,
    farm_location text,
    cage_id_number character varying(50),
    total_birds_purchased integer DEFAULT 0 NOT NULL,
    number_of_birds_died integer NOT NULL,
    cause text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_of_dead_birds numeric(10,2)
);


ALTER TABLE public.mortalities OWNER TO poultry_user;

--
-- Name: mortalities_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.mortalities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mortalities_id_seq OWNER TO poultry_user;

--
-- Name: mortalities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.mortalities_id_seq OWNED BY public.mortalities.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.products (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(50),
    product_type public.product_type_enum,
    unit character varying(20),
    price numeric(14,2),
    description text,
    status public.product_status_enum DEFAULT 'active'::public.product_status_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO poultry_user;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO poultry_user;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.purchase_order_items (
    id bigint NOT NULL,
    purchase_order_id bigint NOT NULL,
    description text NOT NULL,
    quantity numeric(14,2) NOT NULL,
    unit character varying(20) NOT NULL,
    unit_cost numeric(14,2) NOT NULL,
    line_total numeric(14,2) NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO poultry_user;

--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.purchase_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_order_items_id_seq OWNER TO poultry_user;

--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.purchase_order_items_id_seq OWNED BY public.purchase_order_items.id;


--
-- Name: purchase_order_payments; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.purchase_order_payments (
    id bigint NOT NULL,
    purchase_order_id bigint NOT NULL,
    payment_mode character varying(30) NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_advance boolean DEFAULT false NOT NULL
);


ALTER TABLE public.purchase_order_payments OWNER TO poultry_user;

--
-- Name: purchase_order_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.purchase_order_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_order_payments_id_seq OWNER TO poultry_user;

--
-- Name: purchase_order_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.purchase_order_payments_id_seq OWNED BY public.purchase_order_payments.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.purchase_orders (
    id bigint NOT NULL,
    order_number character varying(50) NOT NULL,
    supplier_name character varying(150) NOT NULL,
    order_date date NOT NULL,
    due_date date,
    status public.purchase_status DEFAULT 'pending'::public.purchase_status NOT NULL,
    branch character varying(100),
    unit character varying(100),
    gstin character varying(20),
    lifting_time character varying(50),
    party_code character varying(50),
    pr_number character varying(50),
    hsn_code character varying(20) DEFAULT '0105'::character varying,
    farmer_id bigint,
    farmer_mobile character varying(20),
    farm_location text,
    vehicle_id bigint,
    bird_type character varying(50),
    total_weight numeric(10,2) DEFAULT 0 NOT NULL,
    rate_per_kg numeric(10,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    transport_charges numeric(10,2) DEFAULT 0 NOT NULL,
    loading_charges numeric(10,2) DEFAULT 0 NOT NULL,
    commission numeric(10,2) DEFAULT 0 NOT NULL,
    other_charges numeric(10,2) DEFAULT 0 NOT NULL,
    weight_shortage numeric(10,2) DEFAULT 0 NOT NULL,
    mortality_deduction numeric(10,2) DEFAULT 0 NOT NULL,
    other_deduction numeric(10,2) DEFAULT 0 NOT NULL,
    gross_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) DEFAULT 0 NOT NULL,
    purchase_payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    advance_paid numeric(14,2) DEFAULT 0 NOT NULL,
    outstanding_payment numeric(14,2) DEFAULT 0 NOT NULL,
    payment_mode character varying(50),
    total_payment_made numeric(14,2) DEFAULT 0 NOT NULL,
    balance_amount numeric(14,2) DEFAULT 0 NOT NULL,
    notes text,
    invoice_attachment character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_orders OWNER TO poultry_user;

--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.purchase_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_orders_id_seq OWNER TO poultry_user;

--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: retailers; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.retailers (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    owner_name character varying(150),
    phone character varying(50),
    email character varying(150),
    address text,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.retailers OWNER TO poultry_user;

--
-- Name: retailers_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.retailers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.retailers_id_seq OWNER TO poultry_user;

--
-- Name: retailers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.retailers_id_seq OWNED BY public.retailers.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.role_permissions (
    id bigint NOT NULL,
    role character varying(20) NOT NULL,
    resource character varying(50) NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_read boolean DEFAULT true NOT NULL,
    can_update boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO poultry_user;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.role_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO poultry_user;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: sale_customers; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.sale_customers (
    id bigint NOT NULL,
    sale_id bigint NOT NULL,
    customer_name character varying(150) NOT NULL,
    num_birds integer DEFAULT 0 NOT NULL,
    weight numeric(10,2) DEFAULT 0 NOT NULL,
    rate_per_kg numeric(10,2) DEFAULT 0 NOT NULL,
    amount numeric(14,2) GENERATED ALWAYS AS ((weight * rate_per_kg)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sale_customers OWNER TO poultry_user;

--
-- Name: sale_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.sale_customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_customers_id_seq OWNER TO poultry_user;

--
-- Name: sale_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.sale_customers_id_seq OWNED BY public.sale_customers.id;


--
-- Name: sale_payments; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.sale_payments (
    id bigint NOT NULL,
    sale_id bigint NOT NULL,
    payment_mode character varying(30) NOT NULL,
    amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sale_payments OWNER TO poultry_user;

--
-- Name: sale_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.sale_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_payments_id_seq OWNER TO poultry_user;

--
-- Name: sale_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.sale_payments_id_seq OWNED BY public.sale_payments.id;


--
-- Name: sales; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.sales (
    id bigint NOT NULL,
    invoice_number character varying(50) NOT NULL,
    customer_name character varying(150) NOT NULL,
    sale_date date NOT NULL,
    sale_mode public.sale_mode_type DEFAULT 'from_vehicle'::public.sale_mode_type NOT NULL,
    product_type public.sale_product_type NOT NULL,
    quantity numeric(14,2) NOT NULL,
    unit character varying(20),
    unit_price numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    transport_charges numeric(10,2) DEFAULT 0 NOT NULL,
    loading_charges numeric(10,2) DEFAULT 0 NOT NULL,
    commission numeric(10,2) DEFAULT 0 NOT NULL,
    other_charges numeric(10,2) DEFAULT 0 NOT NULL,
    weight_shortage numeric(10,2) DEFAULT 0 NOT NULL,
    mortality_deduction numeric(10,2) DEFAULT 0 NOT NULL,
    other_deduction numeric(10,2) DEFAULT 0 NOT NULL,
    gross_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) DEFAULT 0 NOT NULL,
    payment_status public.payment_status_type DEFAULT 'pending'::public.payment_status_type NOT NULL,
    amount_received numeric(14,2) DEFAULT 0 NOT NULL,
    notes text,
    retailer_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_birds integer DEFAULT 0 NOT NULL,
    total_weight numeric(10,2) DEFAULT 0 NOT NULL,
    average_weight numeric(10,2) GENERATED ALWAYS AS (
CASE
    WHEN (total_birds > 0) THEN round((total_weight / (total_birds)::numeric), 3)
    ELSE (0)::numeric
END) STORED,
    sale_attachment text,
    sale_no character varying(50),
    purchase_bill_no character varying(50),
    cage_no character varying(100)
);


ALTER TABLE public.sales OWNER TO poultry_user;

--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_id_seq OWNER TO poultry_user;

--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value text NOT NULL,
    category character varying(50),
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settings OWNER TO poultry_user;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.user_permissions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    permission_name character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_read boolean DEFAULT true NOT NULL,
    can_update boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO poultry_user;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_id_seq OWNER TO poultry_user;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'staff'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    phone character varying(50),
    notes text,
    join_date timestamp with time zone,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    session_token text,
    two_factor_secret text,
    is_two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_backup_codes text
);


ALTER TABLE public.users OWNER TO poultry_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO poultry_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: poultry_user
--

CREATE TABLE public.vehicles (
    id bigint NOT NULL,
    vehicle_number character varying(50) NOT NULL,
    vehicle_type character varying(50) NOT NULL,
    driver_name character varying(150) NOT NULL,
    phone character varying(50) NOT NULL,
    owner_name character varying(150),
    address text,
    total_capacity integer,
    petrol_tank_capacity numeric(10,2),
    mileage numeric(10,2),
    join_date date NOT NULL,
    status public.vehicle_status_type DEFAULT 'active'::public.vehicle_status_type NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fuel_type character varying(50)
);


ALTER TABLE public.vehicles OWNER TO poultry_user;

--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: poultry_user
--

CREATE SEQUENCE public.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicles_id_seq OWNER TO poultry_user;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: poultry_user
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cages id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.cages ALTER COLUMN id SET DEFAULT nextval('public.cages_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: farmers id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.farmers ALTER COLUMN id SET DEFAULT nextval('public.farmers_id_seq'::regclass);


--
-- Name: godown_expenses id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_expenses ALTER COLUMN id SET DEFAULT nextval('public.godown_expenses_id_seq'::regclass);


--
-- Name: godown_inward_entries id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_inward_entries ALTER COLUMN id SET DEFAULT nextval('public.godown_inward_entries_id_seq'::regclass);


--
-- Name: godown_mortalities id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_mortalities ALTER COLUMN id SET DEFAULT nextval('public.godown_mortalities_id_seq'::regclass);


--
-- Name: godown_mortality id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_mortality ALTER COLUMN id SET DEFAULT nextval('public.godown_mortality_id_seq'::regclass);


--
-- Name: godown_sale_payments id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_sale_payments ALTER COLUMN id SET DEFAULT nextval('public.godown_sale_payments_id_seq'::regclass);


--
-- Name: godown_sales id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_sales ALTER COLUMN id SET DEFAULT nextval('public.godown_sales_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: mortalities id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.mortalities ALTER COLUMN id SET DEFAULT nextval('public.mortalities_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_order_items id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_items_id_seq'::regclass);


--
-- Name: purchase_order_payments id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_payments ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_payments_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: retailers id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.retailers ALTER COLUMN id SET DEFAULT nextval('public.retailers_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: sale_customers id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_customers ALTER COLUMN id SET DEFAULT nextval('public.sale_customers_id_seq'::regclass);


--
-- Name: sale_payments id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_payments ALTER COLUMN id SET DEFAULT nextval('public.sale_payments_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cages cages_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.cages
    ADD CONSTRAINT cages_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: farmers farmers_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.farmers
    ADD CONSTRAINT farmers_pkey PRIMARY KEY (id);


--
-- Name: godown_expenses godown_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_expenses
    ADD CONSTRAINT godown_expenses_pkey PRIMARY KEY (id);


--
-- Name: godown_inward_entries godown_inward_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_inward_entries
    ADD CONSTRAINT godown_inward_entries_pkey PRIMARY KEY (id);


--
-- Name: godown_mortalities godown_mortalities_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_mortalities
    ADD CONSTRAINT godown_mortalities_pkey PRIMARY KEY (id);


--
-- Name: godown_mortalities godown_mortalities_record_number_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_mortalities
    ADD CONSTRAINT godown_mortalities_record_number_key UNIQUE (record_number);


--
-- Name: godown_mortality godown_mortality_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_mortality
    ADD CONSTRAINT godown_mortality_pkey PRIMARY KEY (id);


--
-- Name: godown_sale_payments godown_sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_sale_payments
    ADD CONSTRAINT godown_sale_payments_pkey PRIMARY KEY (id);


--
-- Name: godown_sales godown_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_sales
    ADD CONSTRAINT godown_sales_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: mortalities mortalities_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.mortalities
    ADD CONSTRAINT mortalities_pkey PRIMARY KEY (id);


--
-- Name: mortalities mortalities_record_number_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.mortalities
    ADD CONSTRAINT mortalities_record_number_key UNIQUE (record_number);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_payments purchase_order_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_payments
    ADD CONSTRAINT purchase_order_payments_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_order_number_key UNIQUE (order_number);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: retailers retailers_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.retailers
    ADD CONSTRAINT retailers_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: sale_customers sale_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_customers
    ADD CONSTRAINT sale_customers_pkey PRIMARY KEY (id);


--
-- Name: sale_payments sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_pkey PRIMARY KEY (id);


--
-- Name: sales sales_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_invoice_number_key UNIQUE (invoice_number);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_vehicle_number_key; Type: CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_number_key UNIQUE (vehicle_number);


--
-- Name: idx_godown_sale_payments_godown_sale_id; Type: INDEX; Schema: public; Owner: poultry_user
--

CREATE INDEX idx_godown_sale_payments_godown_sale_id ON public.godown_sale_payments USING btree (godown_sale_id);


--
-- Name: idx_sale_customers_sale_id; Type: INDEX; Schema: public; Owner: poultry_user
--

CREATE INDEX idx_sale_customers_sale_id ON public.sale_customers USING btree (sale_id);


--
-- Name: cages cages_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.cages
    ADD CONSTRAINT cages_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: godown_sale_payments fk_godown_sale; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.godown_sale_payments
    ADD CONSTRAINT fk_godown_sale FOREIGN KEY (godown_sale_id) REFERENCES public.godown_sales(id) ON DELETE CASCADE;


--
-- Name: mortalities mortalities_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.mortalities
    ADD CONSTRAINT mortalities_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_payments purchase_order_payments_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_order_payments
    ADD CONSTRAINT purchase_order_payments_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.farmers(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: sale_customers sale_customers_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_customers
    ADD CONSTRAINT sale_customers_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_payments sale_payments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_retailer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.retailers(id) ON DELETE SET NULL;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: poultry_user
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict CrcKAa00fZwdynNCpCTC9yLcgWRLFCsnfpRdoJNEDcc84dArot9mJgqt8Y6w2bf

